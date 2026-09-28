plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.kothabarta.core.network"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // org.json.JSONObject (used by encodeSocketPayload) is an Android
    // platform stub outside instrumented tests — it throws by default
    // under plain JUnit unless this is set.
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // AuthApi's/safeApiCall's public signatures return ApiResult (:core:common)
    // and retrofit2.Response/Retrofit (retrofit) — consumers like :feature:auth
    // need those types resolvable too, so both are `api`, not `implementation`.
    // MessagesApi.sendAttachment() likewise takes an okhttp3.MultipartBody.Part
    // parameter, so :feature:messages needs that type resolvable too.
    api(project(":core:common"))
    api(libs.retrofit)
    api(libs.okhttp)
    implementation(project(":core:security"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.moshi)
    implementation(libs.moshi.kotlin)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.junit)
}
