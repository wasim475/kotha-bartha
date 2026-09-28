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

// Only the modules needed for the first Android foundation milestone (see
// docs/architecture/android-implementation-plan.md, section N) are wired up
// here. The other core/feature directories under android/ remain plain,
// unregistered folders until the phase that needs them actually starts —
// see that document's "Feature implementation order" for when each one
// becomes a real Gradle module.
include(":app")
include(":core:common")
include(":core:network")
include(":core:security")
include(":core:datastore")
include(":core:websocket")
include(":core:navigation")
include(":core:ui")
include(":feature:auth")
