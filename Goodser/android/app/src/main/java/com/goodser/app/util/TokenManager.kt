package com.goodser.app.util

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.goodser.app.data.model.ServerEntry
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "goodser_prefs")

class TokenManager(private val context: Context) {
    companion object {
        private val ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val USERNAME = stringPreferencesKey("username")
        private val PASSWORD = stringPreferencesKey("password")
        private val SERVER_URL = stringPreferencesKey("server_url")
        private val SERVER_LIST = stringPreferencesKey("server_list")
        private val REMEMBER_ME = booleanPreferencesKey("remember_me")
        private val LAST_SYNC_TIME = stringPreferencesKey("last_sync_time")
        private val LAST_SYNC_DETAIL = stringPreferencesKey("last_sync_detail")
    }

    val accessTokenFlow: Flow<String?> = context.dataStore.data.map { it[ACCESS_TOKEN] }
    val refreshTokenFlow: Flow<String?> = context.dataStore.data.map { it[REFRESH_TOKEN] }
    val usernameFlow: Flow<String?> = context.dataStore.data.map { it[USERNAME] }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        context.dataStore.edit { it[ACCESS_TOKEN] = accessToken; it[REFRESH_TOKEN] = refreshToken }
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

    suspend fun saveRememberMe(remember: Boolean) {
        context.dataStore.edit { it[REMEMBER_ME] = remember }
    }

    suspend fun getRememberMe(): Boolean = context.dataStore.data.first()[REMEMBER_ME] ?: false

    val lastSyncTimeFlow: Flow<String?> = context.dataStore.data.map { it[LAST_SYNC_TIME] }
    val lastSyncDetailFlow: Flow<String?> = context.dataStore.data.map { it[LAST_SYNC_DETAIL] }

    suspend fun getLastSyncTime(): String? = context.dataStore.data.first()[LAST_SYNC_TIME]
    suspend fun saveLastSyncTime(time: String) { context.dataStore.edit { it[LAST_SYNC_TIME] = time } }
    suspend fun getLastSyncDetail(): String? = context.dataStore.data.first()[LAST_SYNC_DETAIL]
    suspend fun saveLastSyncDetail(detail: String) { context.dataStore.edit { it[LAST_SYNC_DETAIL] = detail } }

    suspend fun getServerList(): List<ServerEntry> {
        val raw = context.dataStore.data.first()[SERVER_LIST]
        if (raw != null) return parseServerList(raw)
        val legacy = context.dataStore.data.first()[SERVER_URL]
        if (legacy != null) {
            val entry = ServerEntry(url = legacy, active = true, order = 0)
            saveServerList(listOf(entry))
            return listOf(entry)
        }
        return emptyList()
    }

    suspend fun getActiveServerUrl(): String? {
        return getServerList().firstOrNull { it.active }?.url
    }

    suspend fun saveServerList(list: List<ServerEntry>) {
        val json = JSONArray()
        list.sortedBy { it.order }.forEach { entry ->
            json.put(JSONObject().apply {
                put("id", entry.id)
                put("url", entry.url)
                put("active", entry.active)
                put("order", entry.order)
            })
        }
        context.dataStore.edit { it[SERVER_LIST] = json.toString() }
    }

    suspend fun addServer(url: String) {
        val list = getServerList().toMutableList()
        val maxOrder = list.maxOfOrNull { it.order } ?: -1
        val hasActive = list.any { it.active }
        list.add(ServerEntry(url = url, active = !hasActive, order = maxOrder + 1))
        saveServerList(list)
    }

    suspend fun removeServer(id: String) {
        val list = getServerList().toMutableList()
        list.removeAll { it.id == id }
        if (list.none { it.active } && list.isNotEmpty()) {
            list[0] = list[0].copy(active = true)
        }
        saveServerList(list)
    }

    suspend fun toggleServer(id: String) {
        val list = getServerList().toMutableList()
        val idx = list.indexOfFirst { it.id == id }
        if (idx == -1) return
        val newActive = !list[idx].active
        list[idx] = list[idx].copy(active = newActive)
        if (newActive) {
            for (i in list.indices) {
                if (i != idx && list[i].active) list[i] = list[i].copy(active = false)
            }
        }
        saveServerList(list)
    }

    suspend fun reorderServer(id: String, up: Boolean) {
        val list = getServerList().toMutableList()
        val idx = list.indexOfFirst { it.id == id }
        if (idx == -1) return
        val target = if (up) idx - 1 else idx + 1
        if (target < 0 || target >= list.size) return
        val temp = list[idx]
        list[idx] = list[target]
        list[target] = temp
        list.forEachIndexed { i, e -> list[i] = e.copy(order = i) }
        saveServerList(list)
    }

    private fun parseServerList(raw: String): List<ServerEntry> {
        val result = mutableListOf<ServerEntry>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                result.add(ServerEntry(
                    id = obj.optString("id", java.util.UUID.randomUUID().toString()),
                    url = obj.optString("url", ""),
                    active = obj.optBoolean("active", true),
                    order = obj.optInt("order", i)
                ))
            }
        } catch (e: Exception) {
            android.util.Log.e("TokenManager", "解析服务器列表失败", e)
        }
        return result.sortedBy { it.order }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}