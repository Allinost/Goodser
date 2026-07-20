package com.goodser.app.ui.outbound

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.goodser.app.data.model.Inventory
import com.goodser.app.data.repository.InventoryRepository
import com.goodser.app.ui.SyncEventBus
import com.goodser.app.ui.components.EmptyState
import com.goodser.app.ui.components.OrderCard
import com.goodser.app.ui.components.PullRefreshBox
import com.goodser.app.ui.components.SearchBar
import com.goodser.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun OutboundListScreen(
    currentInventoryId: String,
    onOrderClick: (String) -> Unit,
    onCreateOutbound: () -> Unit,
    onCreateReserve: () -> Unit,
    viewModel: OutboundListViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    var searchQuery by remember { mutableStateOf("") }
    var showFilter by remember { mutableStateOf(false) }
    var filterStatus by remember { mutableStateOf<String?>(null) }
    var tempFilterStatus by remember { mutableStateOf<String?>(null) }
    var pullRefreshKey by remember { mutableIntStateOf(0) }

    val tabs = listOf("全部", "出库单", "预留单")
    val statusFilters = listOf(
        "全部" to null as String?,
        "待确认" to "pending",
        "已确认" to "confirmed",
        "已取消" to "cancelled"
    )

    val inventoryRepo = remember { InventoryRepository() }
    var inventories by remember { mutableStateOf<List<Inventory>>(emptyList()) }
    var inventoryExpanded by remember { mutableStateOf(false) }
    var selectedInventoryId by remember { mutableStateOf(currentInventoryId) }
    val inventoryName = remember(inventories, selectedInventoryId) {
        inventories.find { it.id == selectedInventoryId }?.name ?: "选择目录"
    }

    LaunchedEffect(currentInventoryId) {
        selectedInventoryId = currentInventoryId
    }

    fun refreshOrders() {
        if (selectedInventoryId.isNotBlank()) {
            viewModel.loadOrders(selectedInventoryId)
        }
    }

    LaunchedEffect(Unit) {
        SyncEventBus.events.collect { pullRefreshKey++; refreshOrders() }
    }

    LaunchedEffect(selectedInventoryId, pullRefreshKey) {
        if (selectedInventoryId.isNotBlank()) {
            viewModel.loadOrders(selectedInventoryId)
            inventoryRepo.loadInventories().onSuccess { inventories = it }
        }
    }

    val searchFiltered = if (searchQuery.isBlank()) state.orders
    else state.orders.filter { order ->
        order.orderNo.contains(searchQuery, ignoreCase = true) ||
        order.items?.any { item ->
            item.productName.contains(searchQuery, ignoreCase = true) ||
            item.productCode.contains(searchQuery, ignoreCase = true)
        } == true
    }

    val filteredOrders = searchFiltered.filter { order ->
        val typeMatch = when (selectedTab) {
            1 -> order.type == "outbound"
            2 -> order.type == "reserve"
            else -> true
        }
        val statusMatch = filterStatus == null || order.status == filterStatus
        typeMatch && statusMatch
    }

    Column(modifier = Modifier.fillMaxSize().background(Background).windowInsetsPadding(WindowInsets.statusBars)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Surface)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box {
                Row(
                    modifier = Modifier.clickable { inventoryExpanded = true },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(inventoryName, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = OnBackground)
                    Icon(
                        Icons.Default.KeyboardArrowDown, "选择目录",
                        modifier = Modifier.size(20.dp),
                        tint = TextSecondary
                    )
                }
                DropdownMenu(
                    expanded = inventoryExpanded,
                    onDismissRequest = { inventoryExpanded = false }
                ) {
                    inventories.forEach { inv ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    inv.name,
                                    fontWeight = if (inv.id == selectedInventoryId) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (inv.id == selectedInventoryId) Primary else OnBackground
                                )
                            },
                            onClick = {
                                selectedInventoryId = inv.id
                                inventoryExpanded = false
                            }
                        )
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onCreateOutbound,
                    colors = ButtonDefaults.buttonColors(containerColor = Primary),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text("📤 出库", fontSize = 13.sp)
                }
                Button(
                    onClick = onCreateReserve,
                    colors = ButtonDefaults.buttonColors(containerColor = Warning),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text("📋 预留", fontSize = 13.sp)
                }
            }
        }

        SearchBar(
            query = searchQuery,
            onQueryChange = { searchQuery = it },
            onSearch = { },
            placeholder = "搜索订单号、商品名称..."
        )

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Surface,
            divider = { HorizontalDivider(color = Divider, thickness = 0.5.dp) }
        ) {
            tabs.forEachIndexed { index, label ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            label,
                            color = if (selectedTab == index) OnBackground else TextSecondary,
                            fontWeight = if (selectedTab == index) FontWeight.SemiBold else FontWeight.Normal,
                            fontSize = 14.sp
                        )
                    }
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Surface)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("共 ${filteredOrders.size} 条记录", fontSize = 13.sp, color = TextSecondary)
            TextButton(onClick = {
                tempFilterStatus = filterStatus
                showFilter = true
            }) {
                Icon(Icons.Default.FilterList, null, modifier = Modifier.size(16.dp), tint = Primary)
                Spacer(Modifier.width(4.dp))
                Text("筛选", fontSize = 13.sp, color = Primary)
            }
        }

        PullRefreshBox(
            refreshing = state.loading,
            onRefresh = { refreshOrders() },
            modifier = Modifier.fillMaxSize()
        ) {
            if (state.loading && state.orders.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Primary)
                }
            } else if (filteredOrders.isEmpty()) {
                EmptyState(
                    icon = "📦",
                    title = if (searchQuery.isNotBlank() || filterStatus != null) "未找到匹配的订单" else "暂无出库单",
                    description = if (searchQuery.isBlank() && filterStatus == null) "点击上方「出库」或「预留」创建" else "试试调整筛选条件"
                )
            } else {
                LazyColumn(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredOrders, key = { it.id }) { order ->
                        OrderCard(order = order, onClick = { onOrderClick(order.id) })
                    }
                }
            }
        }
    }

    if (showFilter) {
        ModalBottomSheet(
            onDismissRequest = { showFilter = false },
            shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("订单状态", fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = OnBackground)
                Spacer(Modifier.height(12.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    statusFilters.forEach { (label, value) ->
                        val selected = tempFilterStatus == value
                        FilterChip(
                            selected = selected,
                            onClick = { tempFilterStatus = value },
                            label = { Text(label, fontSize = 13.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TagBlueBg,
                                selectedLabelColor = TagBlueText
                            ),
                            border = FilterChipDefaults.filterChipBorder(
                                borderColor = if (selected) TagBlueText else Divider,
                                selectedBorderColor = TagBlueText,
                                enabled = true,
                                selected = selected
                            )
                        )
                    }
                }
                Spacer(Modifier.height(24.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            tempFilterStatus = null
                            filterStatus = null
                            showFilter = false
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) { Text("重置") }
                    Button(
                        onClick = {
                            filterStatus = tempFilterStatus
                            showFilter = false
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) { Text("确认筛选") }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}
