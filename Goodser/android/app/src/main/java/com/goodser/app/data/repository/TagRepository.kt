package com.goodser.app.data.repository

import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*

class TagRepository {
    suspend fun loadTags(): Result<List<GoodserTag>> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.loadTags() }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载标签失败")
    }

    suspend fun create(name: String, color: String): Result<GoodserTag> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.createTag(CreateTagReq(name, color)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "创建标签失败")
    }

    suspend fun update(id: String, name: String?, color: String?): Result<GoodserTag> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.updateTagLegacy(UpdateTagReq(id, name, color)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "更新标签失败")
    }

    suspend fun delete(id: String): Result<Unit> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.deleteTag(IdReq(id)) }
        if (resp.code != 0) throw Exception(resp.message ?: "删除标签失败")
    }
}

class StatusCodeRepository {
    suspend fun loadStatusCodes(): Result<List<StatusCode>> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.loadStatusCodes() }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载状态编码失败")
    }

    suspend fun add(code: String, label: String): Result<StatusCode> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.addStatusCode(AddStatusCodeReq(code, label)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "添加状态编码失败")
    }

    suspend fun update(id: String, label: String): Result<StatusCode> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.updateStatusCode(UpdateStatusCodeReq(id, label)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "更新状态编码失败")
    }

    suspend fun remove(id: String): Result<Unit> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.removeStatusCode(IdReq(id)) }
        if (resp.code != 0) throw Exception(resp.message ?: "删除状态编码失败")
    }
}
