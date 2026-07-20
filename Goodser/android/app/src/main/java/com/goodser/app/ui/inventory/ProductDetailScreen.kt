package com.goodser.app.ui.inventory

import androidx.compose.foundation.layout.ExperimentalLayoutApi

import androidx.compose.foundation.background
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
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
import com.goodser.app.data.model.GoodserTag
import com.goodser.app.data.model.QueryProductsReq
import com.goodser.app.data.model.UpdateProductReq
import com.goodser.app.data.repository.ProductRepository
import com.goodser.app.data.repository.TagRepository
import com.goodser.app.ui.SyncEventBus
import com.goodser.app.ui.components.ConfirmDialog
import com.goodser.app.ui.components.InputDialog
import com.goodser.app.ui.components.PullRefreshBox
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)

@Composable
fun ProductDetailScreen(
    productId: String,
    currentInventoryId: String,
    onBack: () -> Unit,
    onEdit: ((String) -> Unit)? = null,
    viewModel: ProductDetailViewModel = viewModel()
) {
    val scope = rememberCoroutineScope()
    val productRepo = remember { ProductRepository() }
    val tagRepo = remember { TagRepository() }
    val state by viewModel.state.collectAsState()
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showTagPicker by remember { mutableStateOf(false) }
    var showNewTagDialog by remember { mutableStateOf(false) }
    var allTags by remember { mutableStateOf<List<GoodserTag>>(emptyList()) }
    var tagPickerSelection by remember { mutableStateOf<Set<String>>(emptySet()) }
    var newTagName by remember { mutableStateOf("") }
    var newTagColor by remember { mutableStateOf("#1890ff") }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        SyncEventBus.events.collect { refreshKey++ }
    }

    LaunchedEffect(productId, currentInventoryId, refreshKey) {
        if (currentInventoryId.isBlank()) return@LaunchedEffect
        viewModel.loadProduct(productId)
        productRepo.queryProducts(QueryProductsReq(inventoryId = currentInventoryId, pageSize = 200)).fold(
            onSuccess = { products ->
                products.find { it.id == productId }?.let { viewModel.setProduct(it) }
            },
            onFailure = {}
        )
        tagRepo.loadTags().fold(
            onSuccess = { allTags = it },
            onFailure = {}
        )
    }
    LaunchedEffect(state.deleted) { if (state.deleted) onBack() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("商品详情") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Primary, titleContentColor = OnPrimary,
                    navigationIconContentColor = OnPrimary
                )
            )
        },
        bottomBar = {
            state.product?.let { product ->
                Surface(shadowElevation = 8.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showDeleteConfirm = true },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Error)
                        ) {
                            Icon(Icons.Default.Delete, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("删除")
                        }
                        Button(
                            onClick = { onEdit?.invoke(product.id) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Primary)
                        ) {
                            Icon(Icons.Default.Edit, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("编辑")
                        }
                    }
                }
            }
        }
    ) { padding ->
        PullRefreshBox(
            refreshing = state.loading,
            onRefresh = { refreshKey++ },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            val product = state.product
            if (state.loading && product == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else if (product == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("商品未找到", color = TextSecondary) }
            } else {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).background(Background)
                // Note: padding is kept here intentionally - the Column is the main content area
                // and needs padding from Scaffold. The PullRefreshBox wraps around it for gesture handling.
            
            ) {
                val allImages = product.images?.takeIf { it.isNotEmpty() } ?: product.imageUrl?.let { listOf(it) } ?: emptyList()
                if (allImages.isNotEmpty()) {
                    val pagerState = rememberPagerState(pageCount = { allImages.size }, initialPage = 0)
                    Box(modifier = Modifier.fillMaxWidth().height(240.dp).background(Color(0xFFF0F0F0))) {
                        HorizontalPager(
                            state = pagerState,
                            modifier = Modifier.fillMaxSize()
                        ) { page ->
                            AsyncImage(
                                model = allImages[page],
                                contentDescription = null,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        }
                        if (allImages.size > 1) {
                            Row(
                                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                repeat(allImages.size) { i ->
                                    Box(
                                        modifier = Modifier
                                            .size(if (pagerState.currentPage == i) 8.dp else 6.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (pagerState.currentPage == i) Primary
                                                else Color.White.copy(alpha = 0.5f)
                                            )
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(240.dp).background(Color(0xFFF0F0F0)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("暂无图片", color = TextSecondary, fontSize = 14.sp)
                    }
                }

                Column(modifier = Modifier.padding(16.dp)) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Surface)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(product.name, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = OnBackground)
                            Spacer(Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(product.code, fontSize = 13.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                                val statusLabel = statusLabel(product.statusCode)
                                Text(
                                    statusLabel,
                                    fontSize = 11.sp,
                                    color = TagBlueText,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier
                                        .background(TagBlueBg, RoundedCornerShape(4.dp))
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    val productTagIds = product.tags ?: emptyList()
                    val productTags = allTags.filter { it.id in productTagIds }
                    if (productTags.isNotEmpty() || true) {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Surface)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("标签", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = OnBackground, modifier = Modifier.weight(1f))
                                    Surface(
                                        onClick = {
                                            tagPickerSelection = productTagIds.toSet()
                                            showTagPicker = true
                                        },
                                        shape = RoundedCornerShape(24.dp),
                                        border = BorderStroke(1.dp, Color(0xFFD9D9D9)),
                                        color = Color.Transparent,
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp), tint = TextSecondary)
                                            Spacer(Modifier.width(2.dp))
                                            Text("+ 标签", fontSize = 13.sp, color = TextSecondary)
                                        }
                                    }
                                }
                                if (productTags.isNotEmpty()) {
                                    Spacer(Modifier.height(8.dp))
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        productTags.forEach { tag ->
                                            TagChip(
                                                tag = tag,
                                                onRemove = {
                                                    val newIds = productTagIds - tag.id
                                                    scope.launch {
                                                        productRepo.update(UpdateProductReq(id = product.id, tags = newIds)).fold(
                                                            onSuccess = { updated ->
                                                                viewModel.setProduct(updated)
                                                                tagRepo.loadTags().fold(
                                                                    onSuccess = { allTags = it },
                                                                    onFailure = {}
                                                                )
                                                            },
                                                            onFailure = {}
                                                        )
                                                    }
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Surface)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            if (product.originalPrice != null && product.originalPrice > 0) {
                                InfoRow("原价", "¥%.2f".format(product.originalPrice))
                            }
                            if (product.marketPrice != null && product.marketPrice > 0) {
                                InfoRow("市场价", "¥%.2f".format(product.marketPrice))
                            }
                            if (product.expectedPrice != null && product.expectedPrice > 0) {
                                InfoRow("预期出售价", "¥%.2f".format(product.expectedPrice), highlight = true)
                            }
                            HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 4.dp))
                            val qtyStr = if (product.reservedQuantity > 0) {
                                "${product.quantity}（已预留 ${product.reservedQuantity}件）"
                            } else product.quantity.toString()
                            InfoRow("库存数量", qtyStr, highlight = true)
                            if (!product.storageLocation.isNullOrBlank()) {
                                InfoRow("仓储位置", product.storageLocation)
                            }
                            HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 4.dp))
                            InfoRow("主分区", product.mainZone)
                            InfoRow("子分区", product.subZone)
                            InfoRow("序号", product.seqNumber.toString().padStart(4, '0'))
                            InfoRow("状态", statusLabel(product.statusCode))
                            HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 4.dp))
                            if (!product.remark.isNullOrBlank()) {
                                InfoRow("备注", product.remark)
                            }
                            InfoRow("创建时间", product.createdAt.take(19))
                            InfoRow("更新时间", product.updatedAt.take(19))
                        }
                    }
                }

                Spacer(Modifier.height(80.dp))
            }
        }
    }
}

    val productForDelete = state.product
    if (showDeleteConfirm && productForDelete != null) {
        ConfirmDialog(
            title = "删除商品",
            message = "确认删除 ${productForDelete.name}？此操作不可恢复。",
            confirmText = "删除",
            onConfirm = { viewModel.deleteProduct(productForDelete.id); showDeleteConfirm = false },
            onDismiss = { showDeleteConfirm = false },
            isDestructive = true
        )
    }

    if (showTagPicker) {
        AlertDialog(
            onDismissRequest = { showTagPicker = false },
            shape = RoundedCornerShape(12.dp),
            title = { Text("选择标签", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    allTags.forEach { tag ->
                        Row(
                            modifier = Modifier.fillMaxWidth()
                                .clickable {
                                    tagPickerSelection = if (tag.id in tagPickerSelection) {
                                        tagPickerSelection - tag.id
                                    } else {
                                        tagPickerSelection + tag.id
                                    }
                                }
                                .padding(vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier.size(12.dp).clip(CircleShape)
                                    .background(parseTagColor(tag.color))
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(tag.name, fontSize = 14.sp, color = OnBackground, modifier = Modifier.weight(1f))
                            if (tag.id in tagPickerSelection) {
                                Text("✓", color = Primary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    TextButton(
                        onClick = { showNewTagDialog = true; newTagName = ""; newTagColor = "#1890ff" }
                    ) {
                        Icon(Icons.Default.Add, null, modifier = Modifier.size(16.dp), tint = Primary)
                        Spacer(Modifier.width(4.dp))
                        Text("新建标签", color = Primary)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    showTagPicker = false
                    scope.launch {
                        productRepo.update(UpdateProductReq(id = productId, tags = tagPickerSelection.toList())).fold(
                            onSuccess = { updated ->
                                viewModel.setProduct(updated)
                                tagRepo.loadTags().fold(onSuccess = { allTags = it }, onFailure = {})
                            },
                            onFailure = {}
                        )
                    }
                }) {
                    Text("确认", color = Primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { showTagPicker = false }) {
                    Text("取消", color = TextSecondary)
                }
            }
        )
    }

    if (showNewTagDialog) {
        AlertDialog(
            onDismissRequest = { showNewTagDialog = false },
            shape = RoundedCornerShape(12.dp),
            title = { Text("新建标签", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    OutlinedTextField(
                        value = newTagName,
                        onValueChange = { newTagName = it },
                        label = { Text("标签名称") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(12.dp))
                    Text("选择颜色", fontSize = 13.sp, color = TextSecondary)
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        tagColors.forEach { colorHex ->
                            val isSelected = newTagColor == colorHex
                            Box(
                                modifier = Modifier.size(32.dp)
                                    .clip(CircleShape)
                                    .background(parseTagColor(colorHex))
                                    .clickable { newTagColor = colorHex },
                                contentAlignment = Alignment.Center
                            ) {
                                if (isSelected) {
                                    Text("✓", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newTagName.isNotBlank()) {
                            showNewTagDialog = false
                            scope.launch {
                                tagRepo.create(newTagName, newTagColor).fold(
                                    onSuccess = { created ->
                                        tagRepo.loadTags().fold(
                                            onSuccess = { updatedTags ->
                                                allTags = updatedTags
                                                tagPickerSelection = tagPickerSelection + created.id
                                            },
                                            onFailure = {}
                                        )
                                    },
                                    onFailure = {}
                                )
                            }
                        }
                    },
                    enabled = newTagName.isNotBlank()
                ) {
                    Text("创建", color = Primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { showNewTagDialog = false }) {
                    Text("取消", color = TextSecondary)
                }
            }
        )
    }
}

private val tagColors = listOf(
    "#1890ff", "#52c41a", "#fa8c16", "#ff4d4f",
    "#722ed1", "#13c2c2", "#eb2f96", "#faad14",
    "#2f54eb", "#a0d911", "#f5222d", "#fa541c"
)

@Composable
fun TagChip(tag: GoodserTag, onRemove: () -> Unit) {
    val tagColor = parseTagColor(tag.color)
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = tagColor.copy(alpha = 0.1f)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 8.dp, end = 4.dp, top = 4.dp, bottom = 4.dp)
        ) {
            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(tagColor))
            Spacer(Modifier.width(6.dp))
            Text(tag.name, fontSize = 12.sp, color = tagColor, fontWeight = FontWeight.Medium)
            Spacer(Modifier.width(4.dp))
            Text(
                "✕",
                fontSize = 12.sp,
                color = tagColor.copy(alpha = 0.6f),
                modifier = Modifier.clickable(onClick = onRemove).padding(2.dp)
            )
        }
    }
}

private fun parseTagColor(hex: String): Color {
    return try {
        val clean = hex.removePrefix("#")
        val argb = if (clean.length == 6) "FF$clean" else clean
        Color(argb.toLong(16))
    } catch (_: Exception) {
        TagBlueText
    }
}

@Composable
fun InfoRow(label: String, value: String, highlight: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = TextSecondary, fontSize = 14.sp)
        Text(
            value,
            color = if (highlight) Primary else OnBackground,
            fontSize = 14.sp,
            fontWeight = if (highlight) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.widthIn(max = 200.dp)
        )
    }
}

private fun statusLabel(code: String): String = when (code) {
    "A" -> "在库"
    "B" -> "售出"
    "C" -> "退货"
    "D" -> "借出"
    else -> code
}
