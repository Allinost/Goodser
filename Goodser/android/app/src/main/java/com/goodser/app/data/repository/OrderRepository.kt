package com.goodser.app.data.repository

import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*

class OrderRepository {
    private val api get() = RetrofitClient.goodserApi

    suspend fun loadOrders(inventoryId: String, page: Int = 1, pageSize: Int = 10): Result<PaginatedResp<OutboundOrder>> = runCatching {
        val resp = api.loadOutboundOrders(PaginatedReq(inventoryId, page, pageSize))
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载出库单失败")
    }

    suspend fun create(req: CreateOutboundReq): Result<OutboundOrder> = runCatching {
        val resp = api.createOutbound(req)
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "创建出库单失败")
    }

    suspend fun confirm(id: String): Result<OutboundOrder> = runCatching {
        val resp = api.confirmOutbound(IdReq(id))
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "确认出库失败")
    }

    suspend fun cancel(id: String): Result<OutboundOrder> = runCatching {
        val resp = api.cancelOutbound(IdReq(id))
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "取消出库失败")
    }

    suspend fun cancelReserve(id: String): Result<OutboundOrder> = runCatching {
        val resp = api.cancelReserve(IdReq(id))
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "取消预留失败")
    }

    suspend fun reserveToOutbound(req: ReserveToOutboundReq): Result<OutboundOrder> = runCatching {
        val resp = api.reserveToOutbound(req)
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "转换预留单失败")
    }
}
