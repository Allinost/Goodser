package com.goodser.app.data.api

import android.util.Log
import com.goodser.app.util.TokenManager
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private var _baseUrl = ""
    private var _initError: String? = null
    private var tokenManager: TokenManager? = null
    private var _retrofit: Retrofit? = null
    private var _authApi: AuthApi? = null
    private var _goodserApi: GoodserApi? = null

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor())
            .addInterceptor(loggingInterceptor)
            .build()
    }

    private fun authInterceptor() = Interceptor { chain ->
        val original = chain.request()
        val token = try {
            tokenManager?.let { runBlocking { it.getAccessToken() } }
        } catch (e: Exception) {
            Log.e("RetrofitClient", "获取Token失败", e); null
        }
        val request = if (token != null) {
            original.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            original
        }
        chain.proceed(request)
    }

    private fun retrofit(): Retrofit {
        if (_baseUrl.isBlank()) throw IllegalStateException("RetrofitClient: baseUrl未设置，请先调用init()")
        if (_retrofit == null || _retrofit?.baseUrl().toString().trimEnd('/') != _baseUrl.trimEnd('/')) {
            _retrofit = try {
                Retrofit.Builder()
                    .baseUrl(_baseUrl)
                    .client(okHttpClient)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build()
            } catch (e: Exception) {
                _retrofit = null
                throw IllegalStateException("RetrofitClient: 创建Retrofit失败 - ${e.message}")
            }
            _authApi = null
            _goodserApi = null
        }
        return _retrofit ?: throw IllegalStateException("RetrofitClient: Retrofit实例不可用")
    }

    val authApi: AuthApi get() {
        if (_authApi == null) _authApi = retrofit().create(AuthApi::class.java)
        return _authApi ?: throw IllegalStateException("RetrofitClient: AuthApi不可用")
    }

    val goodserApi: GoodserApi get() {
        if (_goodserApi == null) _goodserApi = retrofit().create(GoodserApi::class.java)
        return _goodserApi ?: throw IllegalStateException("RetrofitClient: GoodserApi不可用")
    }

    fun init(tokenManager: TokenManager) {
        this.tokenManager = tokenManager
        val savedUrl = try {
            runBlocking { tokenManager.getActiveServerUrl() }
        } catch (e: Exception) {
            _initError = "读取服务器地址失败: ${e.message}"
            Log.e("RetrofitClient", "init失败", e); null
        }
        if (!savedUrl.isNullOrBlank()) {
            updateBaseUrl(savedUrl)
        }
    }

    fun getInitError(): String? = _initError

    fun updateBaseUrl(url: String) {
        val normalized = if (url.endsWith("/")) url else "$url/"
        val finalUrl = if (!normalized.contains("/api/v1/")) {
            "${normalized}api/v1/"
        } else {
            normalized
        }
        if (finalUrl != _baseUrl) {
            _baseUrl = finalUrl
            _retrofit = null
            _authApi = null
            _goodserApi = null
        }
    }

    fun getBaseUrl(): String = _baseUrl

    fun isInitialized(): Boolean = _baseUrl.isNotBlank()
}
