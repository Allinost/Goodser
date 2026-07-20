package com.goodser.app.ui.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.InventoryRepository
import com.goodser.app.data.repository.ProductRepository
import com.goodser.app.data.repository.TagRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class InventoryListUiState(
    val inventories: List<Inventory> = emptyList(),
    val currentInventory: Inventory? = null,
    val products: List<Product> = emptyList(),
    val hasMore: Boolean = false,
    val page: Int = 1,
    val query: String = "",
    val selectedZone: String? = null,
    val selectedStatusCode: String? = null,
    val selectedTagId: String? = null,
    val sortBy: String? = null,
    val sortOrder: String? = null,
    val totalCount: Int = 0,
    val availableZones: List<String> = emptyList(),
    val availableStatusCodes: List<String> = emptyList(),
    val availableTags: List<GoodserTag> = emptyList(),
    val showFilterPanel: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null
)

class InventoryListViewModel : ViewModel() {
    private val inventoryRepo = InventoryRepository()
    private val productRepo = ProductRepository()
    private val tagRepo = TagRepository()
    private val _state = MutableStateFlow(InventoryListUiState())
    val state: StateFlow<InventoryListUiState> = _state

    init { loadInventories() }

    fun loadInventories() {
        viewModelScope.launch {
            inventoryRepo.loadInventories().fold(
                onSuccess = { list ->
                    _state.value = _state.value.copy(inventories = list)
                    if (list.isNotEmpty() && _state.value.currentInventory == null) {
                        selectInventory(list.first())
                    }
                },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }

    fun selectInventory(inventory: Inventory) {
        _state.value = _state.value.copy(currentInventory = inventory, products = emptyList(), page = 1, hasMore = false)
        loadProducts()
        loadFilterOptions()
    }

    private fun loadFilterOptions() {
        val inv = _state.value.currentInventory ?: return
        viewModelScope.launch {
            val zones = mutableSetOf<String>()
            val codes = mutableSetOf<String>()
            productRepo.queryProducts(QueryProductsReq(inv.id, pageSize = 200)).fold(
                onSuccess = { list ->
                    list.forEach {
                        zones.add(it.mainZone)
                        if (it.subZone.isNotBlank()) zones.add("${it.mainZone}${it.subZone}")
                        codes.add(it.statusCode)
                    }
                },
                onFailure = {}
            )
            val tags = tagRepo.loadTags().getOrNull() ?: emptyList()
            _state.value = _state.value.copy(
                availableZones = zones.toList().sorted(),
                availableStatusCodes = codes.toList().sorted(),
                availableTags = tags
            )
        }
    }

    fun loadProducts() {
        val inv = _state.value.currentInventory ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val page = _state.value.page
            productRepo.loadProducts(inv.id, page).fold(
                onSuccess = { resp ->
                    _state.value = _state.value.copy(
                        products = if (page == 1) resp.items else _state.value.products + resp.items,
                        hasMore = resp.hasMore,
                        loading = false
                    )
                },
                onFailure = { _state.value = _state.value.copy(loading = false, error = it.message) }
            )
        }
    }

    fun search() {
        val inv = _state.value.currentInventory ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, page = 1)
            productRepo.queryProducts(QueryProductsReq(
                inventoryId = inv.id,
                keyword = _state.value.query.ifBlank { null },
                statusCode = _state.value.selectedStatusCode,
                mainZone = _state.value.selectedZone?.take(1),
                tagId = _state.value.selectedTagId,
                sortBy = _state.value.sortBy,
                sortOrder = _state.value.sortOrder
            )).fold(
                onSuccess = { list -> _state.value = _state.value.copy(products = list, hasMore = false, loading = false) },
                onFailure = { _state.value = _state.value.copy(loading = false, error = it.message) }
            )
        }
    }

    fun loadMore() {
        if (!_state.value.hasMore || _state.value.loading) return
        _state.value = _state.value.copy(page = _state.value.page + 1)
        loadProducts()
    }

    fun setQuery(q: String) { _state.value = _state.value.copy(query = q) }

    fun setZoneFilter(zone: String?) {
        _state.value = _state.value.copy(selectedZone = zone.takeIf { it?.isNotBlank() == true })
        search()
    }

    fun setStatusCodeFilter(code: String?) {
        _state.value = _state.value.copy(selectedStatusCode = code.takeIf { it?.isNotBlank() == true })
        search()
    }

    fun setTagFilter(tagId: String?) {
        _state.value = _state.value.copy(selectedTagId = tagId.takeIf { it?.isNotBlank() == true })
        search()
    }

    fun toggleFilterPanel() {
        _state.value = _state.value.copy(showFilterPanel = !_state.value.showFilterPanel)
    }

    fun clearFilters() {
        _state.value = _state.value.copy(selectedZone = null, selectedStatusCode = null, selectedTagId = null)
        search()
    }

    fun createInventory(name: String) {
        viewModelScope.launch {
            inventoryRepo.create(name).fold(
                onSuccess = { loadInventories() },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }

    fun deleteInventory(id: String) {
        viewModelScope.launch {
            inventoryRepo.delete(id).fold(
                onSuccess = { loadInventories() },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }
}
