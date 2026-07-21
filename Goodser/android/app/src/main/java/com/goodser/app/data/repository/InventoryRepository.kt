package com.goodser.app.data.repository

import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*

class InventoryRepository {
    suspend fun loadInventories(): Result<List<Inventory>> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.loadInventories() }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载库存目录失败")
    }

    suspend fun create(name: String): Result<Inventory> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.createInventory(CreateInventoryReq(name)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "创建目录失败")
    }

    suspend fun update(id: String, name: String): Result<Inventory> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.updateInventory(UpdateInventoryReq(id, name)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "更新目录失败")
    }

    suspend fun delete(id: String): Result<Unit> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.deleteInventory(IdReq(id)) }
        if (resp.code != 0) throw Exception(resp.message ?: "删除目录失败")
    }
}
