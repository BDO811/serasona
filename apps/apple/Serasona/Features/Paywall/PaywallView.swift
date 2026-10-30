import StoreKit
import SwiftUI

/// Shown when the backend reports the free check-in is used
/// (`SerasonaAPIError.freeCheckInUsed`) or from Settings on demand. Lists the
/// three plans StoreKit's `Products.storekit` defines, matching the web
/// pricing page 1:1 (`Serasona_App/src/pages/Pricing.tsx`).
struct PaywallView: View {
    let onDismiss: () -> Void

    @StateObject private var store = StoreManager.shared
    @ObservedObject private var auth = FirebaseAuthService.shared

    var body: some View {
        NavigationStack {
            ZStack {
                SerasonaColor.surfaceCanvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: SerasonaSpace.s6) {
                        VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                            Text("Make Serasona part of every day")
                                .serasonaStyle(SerasonaType.displaySM)
                                .foregroundStyle(SerasonaColor.inkStrong)

                            Text("Pick a plan for unlimited check-ins and your full 30-day baseline.")
                                .serasonaStyle(SerasonaType.bodyLG)
                                .foregroundStyle(SerasonaColor.inkBody)
                        }

                        if store.isLoadingProducts {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            VStack(spacing: SerasonaSpace.s4) {
                                ForEach(store.products) { product in
                                    PlanCard(
                                        product: product,
                                        isCurrentPlan: isCurrentPlan(product),
                                        isPurchasing: store.isPurchasing,
                                        onPurchase: { Task { await store.purchase(product) } }
                                    )
                                }
                            }
                        }

                        if let error = store.purchaseError {
                            Text(error)
                                .serasonaStyle(SerasonaType.caption)
                                .foregroundStyle(SerasonaColor.stateStrained)
                        }

                        Button("Restore purchases") { Task { await store.restorePurchases() } }
                            .serasonaStyle(SerasonaType.caption)
                            .foregroundStyle(SerasonaColor.tide)
                            .frame(maxWidth: .infinity)
                        Text("Subscriptions renew automatically each month unless canceled. Manage or cancel your Apple subscription in your Apple Account settings.")
                            .serasonaStyle(SerasonaType.caption)
                            .foregroundStyle(SerasonaColor.inkBody)
                        HStack {
                            Link("Privacy policy", destination: SerasonaLegal.privacy)
                            Link("Terms", destination: SerasonaLegal.terms)
                        }.serasonaStyle(SerasonaType.caption)
                        if store.products.isEmpty && !store.isLoadingProducts {
                            Text("Plans are temporarily unavailable.").serasonaStyle(SerasonaType.caption)
                            Button("Reload plans") { Task { await store.loadProducts() } }
                        }
                    }
                    .padding(SerasonaSpace.s6)
                }
            }
            .navigationTitle("Upgrade")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: onDismiss)
                }
            }
        }
    }

    private func isCurrentPlan(_ product: Product) -> Bool {
        guard let subscription = auth.subscription, subscription.isActive else { return false }
        switch product.id {
        case "com.serasona.app.core.monthly": return subscription.planId == .core
        case "com.serasona.app.plus.monthly": return subscription.planId == .plus
        case "com.serasona.app.executive.monthly": return subscription.planId == .executive
        default: return false
        }
    }
}

private struct PlanCard: View {
    let product: Product
    let isCurrentPlan: Bool
    let isPurchasing: Bool
    let onPurchase: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s3) {
            HStack {
                Text(product.displayName)
                    .serasonaStyle(SerasonaType.titleMD)
                    .foregroundStyle(SerasonaColor.inkStrong)
                Spacer()
                Text("\(product.displayPrice)/mo")
                    .serasonaStyle(SerasonaType.titleMD)
                    .foregroundStyle(SerasonaColor.inkStrong)
            }

            Text(product.description)
                .serasonaStyle(SerasonaType.body)
                .foregroundStyle(SerasonaColor.inkBody)

            if isCurrentPlan {
                Text("YOUR CURRENT PLAN")
                    .serasonaStyle(SerasonaType.eyebrow)
                    .foregroundStyle(SerasonaColor.tide)
            } else {
                Button(action: onPurchase) {
                    ZStack {
                        Text("Choose \(product.displayName)")
                            .serasonaStyle(SerasonaType.label)
                            .opacity(isPurchasing ? 0 : 1)
                        if isPurchasing {
                            ProgressView().tint(SerasonaColor.inkOnEmber)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, SerasonaSpace.s3)
                    .foregroundStyle(SerasonaColor.inkOnEmber)
                    .background(SerasonaColor.ember)
                    .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.md))
                }
                .disabled(isPurchasing)
            }
        }
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: SerasonaRadius.lg)
                .stroke(SerasonaColor.borderStrong, lineWidth: 1)
        )
    }
}
