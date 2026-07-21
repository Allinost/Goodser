package com.goodser.app.data.repository

import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*

class InboundRepository {
    suspend fun single(req: InboundSingleReq): Result<Product> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.inboundSingle(req) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "入库失败")
    }

    suspend fun batch(req: InboundBatchReq): Result<InboundBatchResp> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.inboundBatch(req) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "批量入库失败")
    }

    suspend fun searchImport(req: InboundSearchImportReq): Result<InboundSearchImportResp> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.inboundSearchImport(req) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "搜索导入失败")
    }

    suspend fun loadLogs(inventoryId: String, page: Int = 1, pageSize: Int = 20): Result<PaginatedResp<InboundLog>> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.loadInboundLogs(PaginatedReq(inventoryId, page, pageSize)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载入库日志失败")
    }

    suspend fun createLog(req: CreateInboundLogReq): Result<InboundLog> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.createInboundLog(req) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "添加入库记录失败")
    }

    suspend fun updateLog(req: UpdateInboundLogReq): Result<InboundLog> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.updateInboundLog(req) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "更新入库记录失败")
    }

    suspend fun deleteLog(id: String): Result<Unit> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.deleteInboundLog(IdReq(id)) }
        if (resp.code != 0) throw Exception(resp.message ?: "删除入库记录失败")
    }
}
