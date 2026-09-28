plugins {
    alias(libs.plugins.kotlin.jvm)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // SocketManager.on()/.emit() expose io.socket types in their own public
    // signatures, so consumers need them resolvable too — see the same note
    // in :core:network's build file for `retrofit`.
    api(libs.socketio.client)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.junit)
}
