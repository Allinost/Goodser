package com.goodser.app.ui.outbound

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.OrderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class OutboundListUiState(
    val orders: List<OutboundOrder> = emptyList(),
    val filterType: String? = null,
    val page: Int = 1,
    val hasMore: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null
)

class OutboundListViewModel : ViewModel() {
    private val repo = OrderRepository()
    private val _state = MutableStateFlow(OutboundListUiState())
    val state: StateFlow<OutboundListUiState> = _state

    fun loadOrders(inventoryId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            repo.loadOrders(inventoryId).fold(
                onSuccess = { resp ->
                    _state.value = _state.value.copy(orders = resp.items, hasMore = resp.hasMore, loading = false)
                },
                onFailure = { _state.value = _state.value.copy(loading = false, error = it.message) }
            )
        }
    }
}

data class OutboundDetailUiState(
    val order: OutboundOrder? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val updated: Boolean = false
)

class OutboundDetailViewModel : ViewModel() {
    private val repo = OrderRepository()
    private val _state = MutableStateFlow(OutboundDetailUiState())
    val state: StateFlow<OutboundDetailUiState> = _state

    fun setOrder(order: OutboundOrder) { _state.value = _state.value.copy(order = order) }

    fun confirm(id: String) {
        viewModelScope.launch {
            repo.confirm(id).fold(
                onSuccess = { _state.value = _state.value.copy(order = it, updated = true) },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }

    fun cancel(id: String) {
        viewModelScope.launch {
            repo.cancel(id).fold(
                onSuccess = { _state.value = _state.value.copy(order = it, updated = true) },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }

    fun cancelReserve(id: String) {
        viewModelScope.launch {
            repo.cancelReserve(id).fold(
                onSuccess = { _state.value = _state.value.copy(order = it, updated = true) },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }

    fun reserveToOutbound(id: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            val order = _state.value.order ?: return@launch
            repo.reserveToOutbound(ReserveToOutboundReq(
                id = id,
                inventoryId = order.inventoryId,
                orderNo = "OUT-${order.orderNo.drop(4)}",
                items = order.items ?: emptyList(),
                orderInfo = order.orderInfo,
                remark = order.remark
            )).fold(
                onSuccess = { _state.value = _state.value.copy(order = it, loading = false, updated = true) },
                onFailure = { _state.value = _state.value.copy(loading = false, error = it.message) }
            )
        }
    }
}

data class CreateOutboundUiState(
    val products: List<OrderItem> = emptyList(),
    val orderInfo: String = "",
    val remark: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val created: Boolean = false
)

class CreateOutboundViewModel : ViewModel() {
    private val repo = OrderRepository()
    private val _state = MutableStateFlow(CreateOutboundUiState())
    val state: StateFlow<CreateOutboundUiState> = _state

    fun addProduct(item: OrderItem) {
        val existing = _state.value.products.toMutableList()
        val idx = existing.indexOfFirst { it.productId == item.productId }
        if (idx >= 0) existing[idx] = existing[idx].copy(quantity = existing[idx].quantity + item.quantity)
        else existing.add(item)
        _state.value = _state.value.copy(products = existing)
    }

    fun removeProduct(productId: String) {
        _state.value = _state.value.copy(products = _state.value.products.filter { it.productId != productId })
    }

    fun updateQuantity(productId: String, quantity: Int) {
        _state.value = _state.value.copy(
            products = _state.value.products.map {
                if (it.productId == productId) it.copy(quantity = quantity.coerceAtLeast(1)) else it
            }
        )
    }

    fun setOrderInfo(v: String) { _state.value = _state.value.copy(orderInfo = v) }
    fun setRemark(v: String) { _state.value = _state.value.copy(remark = v) }

    fun create(inventoryId: String, isReserve: Boolean = false) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            val orderNo = if (isReserve) "RSV" else "OUT"
            repo.create(CreateOutboundReq(
                inventoryId = inventoryId,
                orderNo = orderNo,
                type = if (isReserve) "reserve" else "outbound",
                orderInfo = _state.value.orderInfo.ifBlank { null },
                remark = _state.value.remark.ifBlank { null },
                items = _state.value.products
            )).fold(
                onSuccess = { _state.value = _state.value.copy(loading = false, created = true) },
                onFailure = { _state.value = _state.value.copy(loading = false, error = it.message) }
            )
        }
    }
}
