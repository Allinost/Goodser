package com.goodser.app.util

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "goodser_prefs")

class TokenManager(private val context: Context) {
    companion object {
        private val ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val USERNAME = stringPreferencesKey("username")
        private val PASSWORD = stringPreferencesKey("password")
        private val SERVER_URL = stringPreferencesKey("server_url")
        private val REMEMBER_ME = booleanPreferencesKey("remember_me")
        private val LAST_SYNC_TIME = stringPreferencesKey("last_sync_time")
        private val LAST_SYNC_DETAIL = stringPreferencesKey("last_sync_detail")
    }

    val accessTokenFlow: Flow<String?> = context.dataStore.data.map { it[ACCESS_TOKEN] }
    val refreshTokenFlow: Flow<String?> = context.dataStore.data.map { it[REFRESH_TOKEN] }
    val usernameFlow: Flow<String?> = context.dataStore.data.map { it[USERNAME] }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        context.dataStore.edit {
            it[ACCESS_TOKEN] = accessToken
            it[REFRESH_TOKEN] = refreshToken
        }
    }

    suspend fun getAccessToken(): String? = context.dataStore.data.first()[ACCESS_TOKEN]

    suspend fun getRefreshToken(): String? = context.dataStore.data.first()[REFRESH_TOKEN]

    suspend fun saveUsername(username: String) {
        context.dataStore.edit { it[USERNAME] = username }
    }

    suspend fun getUsername(): String? = context.dataStore.data.first()[USERNAME]

    suspend fun savePassword(password: String) {
        context.dataStore.edit { it[PASSWORD] = password }
    }

    suspend fun getPassword(): String? = context.dataStore.data.first()[PASSWORD]

    suspend fun saveServerUrl(url: String) {
        context.dataStore.edit { it[SERVER_URL] = url }
    }

    suspend fun getServerUrl(): String? = context.dataStore.data.first()[SERVER_URL]

    suspend fun saveRememberMe(remember: Boolean) {
        context.dataStore.edit { it[REMEMBER_ME] = remember }
    }

    suspend fun getRememberMe(): Boolean = context.dataStore.data.first()[REMEMBER_ME] ?: false

    val lastSyncTimeFlow: Flow<String?> = context.dataStore.data.map { it[LAST_SYNC_TIME] }
    val lastSyncDetailFlow: Flow<String?> = context.dataStore.data.map { it[LAST_SYNC_DETAIL] }

    suspend fun getLastSyncTime(): String? = context.dataStore.data.first()[LAST_SYNC_TIME]

    suspend fun saveLastSyncTime(time: String) {
        context.dataStore.edit { it[LAST_SYNC_TIME] = time }
    }

    suspend fun getLastSyncDetail(): String? = context.dataStore.data.first()[LAST_SYNC_DETAIL]

    suspend fun saveLastSyncDetail(detail: String) {
        context.dataStore.edit { it[LAST_SYNC_DETAIL] = detail }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
