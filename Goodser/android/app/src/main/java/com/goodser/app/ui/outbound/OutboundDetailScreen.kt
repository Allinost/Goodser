package com.goodser.app.ui.outbound

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.goodser.app.data.model.OutboundOrder
import com.goodser.app.data.repository.InventoryRepository
import com.goodser.app.data.repository.OrderRepository
import com.goodser.app.ui.components.ConfirmDialog
import com.goodser.app.ui.components.OrderStatusTag
import com.goodser.app.ui.components.PullRefreshBox
import com.goodser.app.ui.components.TypeTag
import com.goodser.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutboundDetailScreen(
    orderId: String,
    onBack: () -> Unit,
    inventoryId: String = "",
    onProductClick: (String) -> Unit = {},
    viewModel: OutboundDetailViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()
    val order = state.order
    var showConfirm by remember { mutableStateOf(false) }
    var showCancel by remember { mutableStateOf(false) }
    var showConvert by remember { mutableStateOf(false) }
    val repo = remember { OrderRepository() }
    val invRepo = remember { InventoryRepository() }
    var loading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableIntStateOf(0) }

    suspend fun loadFromInventory(invId: String) {
        repo.loadOrders(invId).fold(
            onSuccess = { paginated ->
                val found = paginated.items.find { it.id == orderId }
                if (found != null) {
                    viewModel.setOrder(found)
                    loading = false
                }
            },
            onFailure = { }
        )
    }

    LaunchedEffect(orderId, refreshKey) {
        loading = true
        if (inventoryId.isNotBlank()) {
            loadFromInventory(inventoryId)
        } else {
            invRepo.loadInventories().onSuccess { inventories ->
                for (inv in inventories) {
                    if (!loading) break
                    loadFromInventory(inv.id)
                }
            }
            loading = false
        }
    }

    LaunchedEffect(state.updated) { if (state.updated) onBack() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(order?.orderNo ?: "出库单详情") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Surface, titleContentColor = OnBackground, navigationIconContentColor = OnBackground)
            )
        }
    ) { padding ->
        PullRefreshBox(
            refreshing = loading,
            onRefresh = { refreshKey++ },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            if (loading || order == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Primary)
                }
            } else {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding).background(Background)
            ) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Surface)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(order.orderNo, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = OnBackground)
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    OrderStatusTag(order.status, order.type)
                                    TypeTag(
                                        text = if (order.type == "reserve") "预留单" else "出库单",
                                        bg = if (order.type == "reserve") TagOrangeBg else TagBlueBg,
                                        textColor = if (order.type == "reserve") TagOrangeText else TagBlueText
                                    )
                                }
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(order.createdAt.take(16), fontSize = 13.sp, color = TextSecondary)
                        }
                    }

                    if (!order.orderInfo.isNullOrBlank() || !order.remark.isNullOrBlank() || order.confirmedAt != null || order.cancelledAt != null) {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Surface)
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (!order.orderInfo.isNullOrBlank()) {
                                    DetailRow("订单信息", order.orderInfo)
                                }
                                if (!order.remark.isNullOrBlank()) {
                                    DetailRow("备注", order.remark)
                                }
                                if (order.confirmedAt != null) {
                                    HorizontalDivider(color = Divider)
                                    DetailRow("确认时间", order.confirmedAt.take(19))
                                }
                                if (order.cancelledAt != null) {
                                    HorizontalDivider(color = Divider)
                                    DetailRow("取消时间", order.cancelledAt.take(19))
                                }
                            }
                        }
                    }

                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Surface)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("出库商品", fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = OnBackground)
                            Spacer(Modifier.height(12.dp))
                            order.items?.forEach { item ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable { onProductClick(item.productId) },
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    AsyncImage(
                                        model = item.imageUrl,
                                        contentDescription = null,
                                        modifier = Modifier
                                            .size(44.dp)
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(Color(0xFFF0F0F0)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Spacer(Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            item.productName,
                                            fontWeight = FontWeight.Medium,
                                            fontSize = 14.sp,
                                            color = OnBackground,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(item.productCode, fontSize = 12.sp, color = TextSecondary)
                                    }
                                    Text(
                                        "x ${item.quantity}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp,
                                        color = if (order.type == "reserve") Warning else Primary
                                    )
                                }
                                if (item != order.items?.last()) {
                                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = Divider)
                                }
                            }
                            if (order.items.isNullOrEmpty()) {
                                Text("无商品", fontSize = 14.sp, color = TextSecondary)
                            }
                            Spacer(Modifier.height(8.dp))
                            HorizontalDivider(color = Divider)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "共 ${order.items?.size ?: 0} 种商品，合计 ${order.items?.sumOf { it.quantity } ?: 0} 件",
                                fontSize = 13.sp,
                                color = TextSecondary,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                if (order.status == "pending" || order.status == "reserved") {
                    Surface(shadowElevation = 8.dp, color = Surface) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            if (order.type == "outbound" && order.status == "pending") {
                                OutlinedButton(
                                    onClick = { showCancel = true },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Error)
                                ) { Text("取消出库") }
                                Button(
                                    onClick = { showConfirm = true },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                                ) { Text("确认出库") }
                            } else if (order.type == "reserve") {
                                OutlinedButton(
                                    onClick = { showCancel = true },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Error)
                                ) { Text("取消预留") }
                                Button(
                                    onClick = { showConvert = true },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Warning)
                                ) { Text("转出库") }
                            }
                        }
                    }
                }
            }
        }
    }
}

    if (showConfirm && order != null) {
        ConfirmDialog(
            title = "确认出库",
            message = "确定确认此出库单？",
            onConfirm = { viewModel.confirm(order.id); showConfirm = false },
            onDismiss = { showConfirm = false }
        )
    }
    if (showCancel && order != null) {
        ConfirmDialog(
            title = "取消",
            message = "确定取消此${if (order.type == "reserve") "预留单" else "出库单"}？",
            onConfirm = {
                if (order.type == "reserve") viewModel.cancelReserve(order.id) else viewModel.cancel(order.id)
                showCancel = false
            },
            onDismiss = { showCancel = false },
            isDestructive = true
        )
    }
    if (showConvert && order != null) {
        ConfirmDialog(
            title = "转出库",
            message = "将预留单「${order.orderNo}」转为出库单？所有预留商品将转为正式出库。",
            onConfirm = { viewModel.reserveToOutbound(order.id); showConvert = false },
            onDismiss = { showConvert = false }
        )
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = TextSecondary, fontSize = 14.sp)
        Text(value, color = OnBackground, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
