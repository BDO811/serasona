import Foundation
import StoreKit

/// Owns the StoreKit 2 side of billing: loading the three plan products,
/// running a purchase, and redeeming whatever transaction comes back (a new
/// purchase, a restore, or a renewal picked up by `Transaction.updates`)
/// against `apple-iap-verify` so Firestore's `subscription` field — the one
/// thing every entitlement check actually reads — stays current.
@MainActor
final class StoreManager: ObservableObject {
    static let shared = StoreManager()

    /// Order matches the paywall's display order and `Products.storekit`'s
    /// `groupNumber`s (low to high).
    static let productIDs = [
        "com.serasona.app.core.monthly",
        "com.serasona.app.plus.monthly",
        "com.serasona.app.executive.monthly",
    ]

    @Published private(set) var products: [Product] = []
    @Published private(set) var isLoadingProducts = true
    @Published var purchaseError: String?
    @Published private(set) var isPurchasing = false

    private var updatesTask: Task<Void, Never>?

    private init() {
        updatesTask = Task { [weak self] in
            for await update in StoreKit.Transaction.updates {
                await self?.handle(update)
            }
        }
        Task { await loadProducts() }
    }

    deinit {
        updatesTask?.cancel()
    }

    func loadProducts() async {
        isLoadingProducts = true
        do {
            let fetched = try await Product.products(for: Self.productIDs)
            products = Self.productIDs.compactMap { id in fetched.first { $0.id == id } }
        } catch {
            purchaseError = "Couldn't load plans: \(error.localizedDescription)"
        }
        isLoadingProducts = false
    }

    func purchase(_ product: Product) async {
        isPurchasing = true
        purchaseError = nil
        do {
            let result = try await product.purchase(options: [.appAccountToken(try ApplePurchaseIdentity.token())])
            switch result {
            case .success(let verification):
                await handle(verification)
            case .userCancelled:
                break
            case .pending:
                purchaseError = "This purchase needs approval (e.g. Ask to Buy) before it completes."
            @unknown default:
                break
            }
        } catch {
            purchaseError = error.localizedDescription
        }
        isPurchasing = false
    }

    func restorePurchases() async {
        purchaseError = nil
        do {
            try await AppStore.sync()
            await syncEntitlements()
        } catch {
            purchaseError = "Couldn't restore purchases: \(error.localizedDescription)"
        }
    }

    func syncEntitlements() async {
        for await entitlement in StoreKit.Transaction.currentEntitlements {
            await handle(entitlement)
        }
    }

    private func handle(_ verification: VerificationResult<StoreKit.Transaction>) async {
        guard case .verified(let transaction) = verification else {
            purchaseError = "Apple couldn't verify that transaction."
            return
        }
        do {
            try await SerasonaAPI.redeemAppleTransaction(
                signedTransactionInfo: verification.jwsRepresentation,
                environment: environmentName(transaction.environment)
            )
        } catch {
            purchaseError = error.localizedDescription
            return
        }
        await transaction.finish()
    }

    private func environmentName(_ environment: AppStore.Environment) -> String {
        switch environment {
        case .xcode: return "Xcode"
        case .sandbox: return "Sandbox"
        case .production: return "Production"
        default: return "Sandbox"
        }
    }
}
