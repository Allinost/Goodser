package com.goodser.app.data.repository

import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*

class InboundRepository {
    private val api get() = RetrofitClient.goodserApi

    suspend fun single(req: InboundSingleReq): Result<Product> = runCatching {
        val resp = api.inboundSingle(req)
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "入库失败")
    }

    suspend fun batch(req: InboundBatchReq): Result<InboundBatchResp> = runCatching {
        val resp = api.inboundBatch(req)
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "批量入库失败")
    }

    suspend fun searchImport(req: InboundSearchImportReq): Result<InboundSearchImportResp> = runCatching {
        val resp = api.inboundSearchImport(req)
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "搜索导入失败")
    }

    suspend fun loadLogs(inventoryId: String, page: Int = 1, pageSize: Int = 20): Result<PaginatedResp<InboundLog>> = runCatching {
        val resp = api.loadInboundLogs(PaginatedReq(inventoryId, page, pageSize))
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载入库日志失败")
    }

    suspend fun createLog(req: CreateInboundLogReq): Result<InboundLog> = runCatching {
        val resp = api.createInboundLog(req)
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "添加入库记录失败")
    }

    suspend fun updateLog(req: UpdateInboundLogReq): Result<InboundLog> = runCatching {
        val resp = api.updateInboundLog(req)
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "更新入库记录失败")
    }

    suspend fun deleteLog(id: String): Result<Unit> = runCatching {
        val resp = api.deleteInboundLog(IdReq(id))
        if (resp.code != 0) throw Exception(resp.message ?: "删除入库记录失败")
    }
}
