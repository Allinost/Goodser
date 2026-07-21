package com.goodser.app.data.api

import android.util.Log
import com.goodser.app.util.TokenManager
import java.io.IOException
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private var _initError: String? = null
    private var tokenManager: TokenManager? = null
    private val goodserApiCache = mutableMapOf<String, GoodserApi>()
    private val authApiCache = mutableMapOf<String, AuthApi>()
    private val retrofitCache = mutableMapOf<String, Retrofit>()

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

    private fun normalizeUrl(url: String): String {
        val normalized = if (url.endsWith("/")) url else "$url/"
        return if (!normalized.contains("/api/v1/")) "${normalized}api/v1/" else normalized
    }

    private fun getRetrofit(baseUrl: String): Retrofit {
        return retrofitCache.getOrPut(baseUrl) {
            Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }
    }

    private fun getGoodserApi(baseUrl: String): GoodserApi {
        return goodserApiCache.getOrPut(baseUrl) {
            getRetrofit(baseUrl).create(GoodserApi::class.java)
        }
    }

    private fun getAuthApi(baseUrl: String): AuthApi {
        return authApiCache.getOrPut(baseUrl) {
            getRetrofit(baseUrl).create(AuthApi::class.java)
        }
    }

    fun init(tokenManager: TokenManager) {
        this.tokenManager = tokenManager
    }

    fun getInitError(): String? = _initError

    suspend fun <T> callWithFailover(block: suspend (GoodserApi) -> T): T {
        val urls = tokenManager?.getActiveServerUrls() ?: emptyList()
        if (urls.isEmpty()) throw IllegalStateException("没有可用的服务器，请先在设置中添加服务器")
        val errors = mutableListOf<String>()
        for (url in urls) {
            try {
                return block(getGoodserApi(normalizeUrl(url)))
            } catch (e: Exception) {
                errors.add("[$url] ${e.message}")
            }
        }
        throw IOException("所有服务器均失败: ${errors.joinToString("; ")}")
    }

    suspend fun <T> callAuthWithFailover(block: suspend (AuthApi) -> T): T {
        val urls = tokenManager?.getActiveServerUrls() ?: emptyList()
        if (urls.isEmpty()) throw IllegalStateException("没有可用的服务器，请先在设置中添加服务器")
        val errors = mutableListOf<String>()
        for (url in urls) {
            try {
                return block(getAuthApi(normalizeUrl(url)))
            } catch (e: Exception) {
                errors.add("[$url] ${e.message}")
            }
        }
        throw IOException("所有服务器均失败: ${errors.joinToString("; ")}")
    }
}
