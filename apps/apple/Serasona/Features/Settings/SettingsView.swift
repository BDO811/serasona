import Foundation
import SwiftUI

struct SettingsView: View {
    @ObservedObject private var auth = FirebaseAuthService.shared
    @State private var logOutError: String?
    @State private var showPaywall = false
    @State private var remindersEnabled = CheckInReminders.isEnabled
    @State private var reminderTime = SettingsView.initialReminderTime()
    @State private var reminderError: String?
    @State private var showDeleteAccount = false

    var body: some View {
        NavigationStack {
            ZStack {
                SerasonaColor.surfaceCanvas.ignoresSafeArea()

                ScrollView {
                  VStack(alignment: .leading, spacing: SerasonaSpace.s6) {
                    VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                        Text("SIGNED IN AS")
                            .serasonaStyle(SerasonaType.eyebrow)
                            .foregroundStyle(SerasonaColor.inkMuted)

                        Text(auth.email ?? "—")
                            .serasonaStyle(SerasonaType.body)
                            .foregroundStyle(SerasonaColor.inkStrong)

                        Button("Log out", role: .destructive, action: logOut)
                            .serasonaStyle(SerasonaType.label)
                            .foregroundStyle(SerasonaColor.stateStrained)
                            .padding(.top, SerasonaSpace.s2)

                        if let logOutError {
                            Text(logOutError)
                                .serasonaStyle(SerasonaType.caption)
                                .foregroundStyle(SerasonaColor.stateStrained)
                        }

                        Button("Delete account") { showDeleteAccount = true }
                            .serasonaStyle(SerasonaType.label)
                            .foregroundStyle(SerasonaColor.inkMuted)
                            .padding(.top, SerasonaSpace.s1)
                    }

                    Divider().background(SerasonaColor.borderHairline)

                    VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                        Text("PLAN")
                            .serasonaStyle(SerasonaType.eyebrow)
                            .foregroundStyle(SerasonaColor.inkMuted)

                        Text(planDescription)
                            .serasonaStyle(SerasonaType.body)
                            .foregroundStyle(SerasonaColor.inkStrong)

                        Button("Upgrade plan") { showPaywall = true }
                            .serasonaStyle(SerasonaType.label)
                            .foregroundStyle(SerasonaColor.tide)
                            .padding(.top, SerasonaSpace.s2)
                    }

                    Divider().background(SerasonaColor.borderHairline)

                    VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                        Text("REMINDERS")
                            .serasonaStyle(SerasonaType.eyebrow)
                            .foregroundStyle(SerasonaColor.inkMuted)

                        Toggle("Check-in reminders", isOn: remindersBinding)
                            .serasonaStyle(SerasonaType.body)
                            .foregroundStyle(SerasonaColor.inkStrong)
                            .tint(SerasonaColor.ember)

                        if remindersEnabled {
                            Text("Monday, Wednesday and Friday")
                                .serasonaStyle(SerasonaType.caption)
                                .foregroundStyle(SerasonaColor.inkMuted)

                            DatePicker("Time", selection: $reminderTime, displayedComponents: .hourAndMinute)
                                .serasonaStyle(SerasonaType.body)
                                .foregroundStyle(SerasonaColor.inkStrong)
                                .tint(SerasonaColor.tide)
                                .onChange(of: reminderTime) { _, newValue in
                                    let components = Calendar.current.dateComponents([.hour, .minute], from: newValue)
                                    CheckInReminders.setTime(hour: components.hour ?? 9, minute: components.minute ?? 0)
                                }
                        }

                        if let reminderError {
                            Text(reminderError)
                                .serasonaStyle(SerasonaType.caption)
                                .foregroundStyle(SerasonaColor.stateStrained)
                        }
                    }

                    Divider().background(SerasonaColor.borderHairline)

                    VStack(alignment: .leading, spacing: SerasonaSpace.s1) {
                        Text("ABOUT")
                            .serasonaStyle(SerasonaType.eyebrow)
                            .foregroundStyle(SerasonaColor.inkMuted)
                        Text("Serasona")
                            .serasonaStyle(SerasonaType.titleMD)
                            .foregroundStyle(SerasonaColor.inkStrong)
                        Text("serasona.com")
                            .serasonaStyle(SerasonaType.readout)
                            .foregroundStyle(SerasonaColor.tide)
                        Link("Privacy policy", destination: SerasonaLegal.privacy)
                        Link("Terms of service", destination: SerasonaLegal.terms)
                        Link("Manage Apple subscription", destination: SerasonaLegal.subscriptions)
                    }

                  }
                  .frame(maxWidth: .infinity, alignment: .leading)
                  .padding(SerasonaSpace.s6)
                  .padding(.bottom, SerasonaSpace.s6)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showPaywall) {
                PaywallView(onDismiss: { showPaywall = false })
            }
            .sheet(isPresented: $showDeleteAccount) {
                DeleteAccountView(onDismiss: { showDeleteAccount = false })
            }
        }
    }

    private var planDescription: String {
        guard let subscription = auth.subscription, subscription.isActive else { return "Free" }
        switch subscription.planId {
        case .free: return "Free"
        case .core: return "Serasona Core"
        case .plus: return "Serasona Plus"
        case .executive: return "Serasona Executive"
        }
    }

    private func logOut() {
        do {
            try FirebaseAuthService.shared.logOut()
        } catch {
            logOutError = error.localizedDescription
        }
    }

    private var remindersBinding: Binding<Bool> {
        Binding(
            get: { remindersEnabled },
            set: { newValue in
                if newValue {
                    Task {
                        let granted = await CheckInReminders.enable()
                        remindersEnabled = granted
                        reminderError = granted ? nil : "Enable notifications for Serasona in iOS Settings to turn reminders on."
                    }
                } else {
                    CheckInReminders.disable()
                    remindersEnabled = false
                    reminderError = nil
                }
            }
        )
    }

    private static func initialReminderTime() -> Date {
        var components = CheckInReminders.time
        components.year = 2000
        components.month = 1
        components.day = 1
        return Calendar.current.date(from: components) ?? Date()
    }
}
