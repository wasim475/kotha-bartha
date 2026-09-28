pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "kotha-barta"

// Only the modules built so far (foundation milestone + Phase 2's Home/
// Profile/Friends/Notifications, see docs/architecture/android-implementation-plan.md)
// are wired up here. The remaining feature directories under android/ stay
// plain, unregistered folders until the phase that needs them starts.
include(":app")
include(":core:common")
include(":core:network")
include(":core:security")
include(":core:datastore")
include(":core:websocket")
include(":core:navigation")
include(":core:ui")
include(":feature:auth")
include(":feature:home")
include(":feature:profile")
include(":feature:friends")
include(":feature:notifications")
