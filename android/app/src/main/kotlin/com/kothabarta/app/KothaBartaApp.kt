package com.kothabarta.app

import android.app.Application
import com.kothabarta.app.di.coreModule
import com.kothabarta.feature.auth.di.authFeatureModule
import com.kothabarta.feature.friends.di.friendsFeatureModule
import com.kothabarta.feature.home.di.homeFeatureModule
import com.kothabarta.feature.notifications.di.notificationsFeatureModule
import com.kothabarta.feature.profile.di.profileFeatureModule
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin

class KothaBartaApp : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            if (BuildConfig.DEBUG) androidLogger()
            androidContext(this@KothaBartaApp)
            modules(
                coreModule,
                authFeatureModule,
                homeFeatureModule,
                profileFeatureModule,
                friendsFeatureModule,
                notificationsFeatureModule,
            )
        }
    }
}
