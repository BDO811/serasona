// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "SerasonaKit",
    platforms: [
        .iOS(.v16),
        .watchOS(.v9),
    ],
    products: [
        .library(name: "SerasonaKit", targets: ["SerasonaKit"])
    ],
    targets: [
        .target(name: "SerasonaKit"),
        .testTarget(name: "SerasonaKitTests", dependencies: ["SerasonaKit"]),
    ]
)
