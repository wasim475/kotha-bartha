plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// Firebase config is project-specific and deliberately not committed. Apply the
// plugin only after the owner adds the console-generated app/google-services.json.
if (file("google-services.json").exists()) {
    pluginManager.apply("com.google.gms.google-services")
}

val debugApiBaseUrl = providers.gradleProperty("API_BASE_URL")
    .orElse("https://kotha-bartha.onrender.com/api/v1/")
    .get()
val debugSocketUrl = providers.gradleProperty("SOCKET_URL")
    .orElse("https://kotha-bartha.onrender.com")
    .get()
val googleWebClientId = providers.gradleProperty("GOOGLE_WEB_CLIENT_ID")
    .orElse("758733508959-4ptqjr4o27lg073pulpen7rd4frd17vm.apps.googleusercontent.com")
    .get()
val callStunUrls = providers.gradleProperty("CALL_STUN_URLS")
    .orElse("stun:stun.l.google.com:19302")
    .get()
val callTurnUrl = providers.gradleProperty("CALL_TURN_URL").orElse("").get()
val callTurnUsername = providers.gradleProperty("CALL_TURN_USERNAME").orElse("").get()
val callTurnCredential = providers.gradleProperty("CALL_TURN_CREDENTIAL").orElse("").get()

fun String.asBuildConfigString(): String = "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "com.kothabarta.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.kothabarta.app"
        minSdk = 26
        targetSdk = 35
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        versionCode = 1
        versionName = "0.1.0-foundation"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
        buildConfigField("String", "CALL_STUN_URLS", callStunUrls.asBuildConfigString())
        buildConfigField("String", "CALL_TURN_URL", callTurnUrl.asBuildConfigString())
        buildConfigField("String", "CALL_TURN_USERNAME", callTurnUsername.asBuildConfigString())
        buildConfigField("String", "CALL_TURN_CREDENTIAL", callTurnCredential.asBuildConfigString())
    }

    buildTypes {
        debug {
            // Keep Android on the same hosted API as the web client by default.
            // Local development can override these with Gradle properties.
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
            buildConfigField("String", "SOCKET_URL", "\"$debugSocketUrl\"")
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"https://kotha-bartha.onrender.com/api/v1/\"")
            buildConfigField("String", "SOCKET_URL", "\"https://kotha-bartha.onrender.com\"")
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":core:common"))
    implementation(project(":core:network"))
    implementation(project(":core:security"))
    implementation(project(":core:datastore"))
    implementation(project(":core:websocket"))
    implementation(project(":core:navigation"))
    implementation(project(":core:ui"))
    implementation(project(":core:media"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:home"))
    implementation(project(":feature:profile"))
    implementation(project(":feature:friends"))
    implementation(project(":feature:notifications"))
    implementation(project(":feature:messages"))
    implementation(project(":feature:study"))
    implementation(project(":feature:quiz"))
    implementation(project(":feature:games"))
    implementation(project(":feature:leaderboard"))
    implementation(project(":feature:tic_tac_toe"))
    implementation(project(":feature:ludo"))
    implementation(project(":feature:calls"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    debugImplementation(libs.androidx.ui.tooling)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.koin.android)
    implementation(libs.koin.androidx.compose)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.coil.compose)

    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
