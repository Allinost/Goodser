package com.goodser.app.data.repository

import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*

class InventoryRepository {
    private val api get() = RetrofitClient.goodserApi

    suspend fun loadInventories(): Result<List<Inventory>> = runCatching {
        val resp = api.loadInventories()
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载库存目录失败")
    }

    suspend fun create(name: String): Result<Inventory> = runCatching {
        val resp = api.createInventory(CreateInventoryReq(name))
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "创建目录失败")
    }

    suspend fun update(id: String, name: String): Result<Inventory> = runCatching {
        val resp = api.updateInventory(UpdateInventoryReq(id, name))
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "更新目录失败")
    }

    suspend fun delete(id: String): Result<Unit> = runCatching {
        val resp = api.deleteInventory(IdReq(id))
        if (resp.code != 0) throw Exception(resp.message ?: "删除目录失败")
    }
}
