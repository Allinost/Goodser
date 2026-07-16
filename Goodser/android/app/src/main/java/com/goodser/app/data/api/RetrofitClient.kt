package com.goodser.app.data.api

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
        val token = tokenManager?.let {
            runBlocking { it.getAccessToken() }
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
        if (_retrofit == null || _retrofit?.baseUrl().toString().trimEnd('/') != _baseUrl.trimEnd('/')) {
            _retrofit = Retrofit.Builder()
                .baseUrl(_baseUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
            _authApi = null
            _goodserApi = null
        }
        return _retrofit!!
    }

    val authApi: AuthApi get() {
        if (_authApi == null) _authApi = retrofit().create(AuthApi::class.java)
        return _authApi!!
    }

    val goodserApi: GoodserApi get() {
        if (_goodserApi == null) _goodserApi = retrofit().create(GoodserApi::class.java)
        return _goodserApi!!
    }

    fun init(tokenManager: TokenManager) {
        this.tokenManager = tokenManager
        val savedUrl = runBlocking { tokenManager.getServerUrl() }
        if (!savedUrl.isNullOrBlank()) {
            updateBaseUrl(savedUrl)
        }
    }

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
