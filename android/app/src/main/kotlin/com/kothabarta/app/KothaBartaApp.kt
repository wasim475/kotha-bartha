package com.kothabarta.app

import android.app.Application
import com.kothabarta.app.di.coreModule
import com.kothabarta.feature.auth.di.authFeatureModule
import com.kothabarta.feature.friends.di.friendsFeatureModule
import com.kothabarta.feature.games.di.gamesFeatureModule
import com.kothabarta.feature.home.di.homeFeatureModule
import com.kothabarta.feature.leaderboard.di.leaderboardFeatureModule
import com.kothabarta.feature.ludo.di.ludoFeatureModule
import com.kothabarta.feature.messages.di.messagesFeatureModule
import com.kothabarta.feature.notifications.di.notificationsFeatureModule
import com.kothabarta.feature.profile.di.profileFeatureModule
import com.kothabarta.feature.quiz.di.quizFeatureModule
import com.kothabarta.feature.study.di.studyFeatureModule
import com.kothabarta.feature.tictactoe.di.tttFeatureModule
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
                messagesFeatureModule,
                studyFeatureModule,
                quizFeatureModule,
                leaderboardFeatureModule,
                tttFeatureModule,
                gamesFeatureModule,
                ludoFeatureModule,
            )
        }
    }
}
