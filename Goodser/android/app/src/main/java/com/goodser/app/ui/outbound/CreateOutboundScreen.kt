package com.goodser.app.ui.outbound

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.goodser.app.ui.components.NetworkImage
import com.goodser.app.ui.components.resolveImageUrl
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.InventoryRepository
import com.goodser.app.data.repository.ProductRepository
import com.goodser.app.ui.components.SearchBar
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateOutboundScreen(
    currentInventoryId: String,
    onBack: () -> Unit,
    isReserve: Boolean = false,
    viewModel: CreateOutboundViewModel = viewModel()
) {
    val state by viewModel.state.collectAsState()
    val accentColor = if (isReserve) Warning else Primary
    val accentBg = if (isReserve) TagOrangeBg else TagBlueBg
    val title = if (isReserve) "新建预留单" else "新建出库单"

    val scope = rememberCoroutineScope()
    val productRepo = remember { ProductRepository() }
    val inventoryRepo = remember { InventoryRepository() }

    var keyword by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<Product>>(emptyList()) }
    var hasSearched by remember { mutableStateOf(false) }
    var multiSelectMode by remember { mutableStateOf(false) }
    var selectedProductIds by remember { mutableStateOf(setOf<String>()) }

    var inventories by remember { mutableStateOf<List<Inventory>>(emptyList()) }
    var inventoryExpanded by remember { mutableStateOf(false) }
    var selectedInventoryId by remember { mutableStateOf(currentInventoryId) }
    val inventoryName = remember(inventories, selectedInventoryId) {
        inventories.find { it.id == selectedInventoryId }?.name ?: "请选择出库目录"
    }

    LaunchedEffect(currentInventoryId) {
        selectedInventoryId = currentInventoryId
        inventoryRepo.loadInventories().onSuccess { inventories = it }
    }

    LaunchedEffect(state.created) { if (state.created) onBack() }

    fun doSearch() {
        if (selectedInventoryId.isBlank()) return
        hasSearched = true
        scope.launch {
            productRepo.queryProducts(
                QueryProductsReq(selectedInventoryId, keyword = keyword.ifBlank { null })
            ).fold(
                onSuccess = { searchResults = it },
                onFailure = { searchResults = emptyList() }
            )
        }
    }

    fun addProduct(product: Product) {
        viewModel.addProduct(
            OrderItem(product.id, product.name, product.code, 1, product.imageUrl)
        )
    }

    fun addSelectedProducts() {
        searchResults.filter { it.id in selectedProductIds }.forEach { addProduct(it) }
        selectedProductIds = emptySet()
        multiSelectMode = false
    }

    fun isProductSelected(id: String): Boolean {
        val existing = state.products.find { it.productId == id }
        return existing != null
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Surface, titleContentColor = OnBackground, navigationIconContentColor = OnBackground)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).background(Background)) {
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
                        Text(if (isReserve) "预留目录" else "出库目录", fontSize = 14.sp, color = TextSecondary)
                        Spacer(Modifier.height(8.dp))
                        Box {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(accentBg, RoundedCornerShape(8.dp))
                                    .clickable { inventoryExpanded = true }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    inventoryName,
                                    color = if (inventories.find { it.id == selectedInventoryId } != null) OnBackground else TextSecondary,
                                    fontSize = 14.sp
                                )
                                Icon(Icons.Default.KeyboardArrowDown, null, tint = TextSecondary)
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
                                                color = if (inv.id == selectedInventoryId) accentColor else OnBackground
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
                    }
                }

                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        TextField(
                            value = state.orderInfo,
                            onValueChange = { viewModel.setOrderInfo(it) },
                            placeholder = { Text("订单信息（可选）", fontSize = 14.sp, color = TextSecondary) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = Color.Transparent,
                                unfocusedContainerColor = Color.Transparent,
                                focusedIndicatorColor = accentColor,
                                unfocusedIndicatorColor = Divider,
                                cursorColor = accentColor,
                                focusedTextColor = OnBackground,
                                unfocusedTextColor = OnBackground
                            ),
                            textStyle = TextStyle(fontSize = 14.sp)
                        )
                        TextField(
                            value = state.remark,
                            onValueChange = { viewModel.setRemark(it) },
                            placeholder = { Text("订单备注（可选）", fontSize = 14.sp, color = TextSecondary) },
                            minLines = 3,
                            modifier = Modifier.fillMaxWidth(),
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = Color.Transparent,
                                unfocusedContainerColor = Color.Transparent,
                                focusedIndicatorColor = accentColor,
                                unfocusedIndicatorColor = Divider,
                                cursorColor = accentColor,
                                focusedTextColor = OnBackground,
                                unfocusedTextColor = OnBackground
                            ),
                            textStyle = TextStyle(fontSize = 14.sp)
                        )
                    }
                }

                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Surface)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                if (isReserve) "预留商品" else "出库商品",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                                color = OnBackground
                            )
                            if (hasSearched && searchResults.isNotEmpty()) {
                                TextButton(onClick = {
                                    multiSelectMode = !multiSelectMode
                                    if (!multiSelectMode) selectedProductIds = emptySet()
                                }) {
                                    Text(
                                        if (multiSelectMode) "取消多选" else "多选",
                                        fontSize = 13.sp,
                                        color = if (multiSelectMode) Error else accentColor
                                    )
                                }
                            }
                        }

                        SearchBar(
                            query = keyword,
                            onQueryChange = { keyword = it },
                            onSearch = { doSearch() },
                            placeholder = "搜索商品名称或编码"
                        )

                        if (hasSearched) {
                            if (searchResults.isEmpty() && keyword.isNotBlank()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(32.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("未找到匹配的商品", fontSize = 14.sp, color = TextSecondary)
                                }
                            } else if (searchResults.isNotEmpty()) {
                                searchResults.forEach { product ->
                                    val alreadyAdded = isProductSelected(product.id)
                                    val isChecked = product.id in selectedProductIds
                                    val bgColor = when {
                                        isChecked && multiSelectMode -> if (isReserve) TagOrangeBg.copy(alpha = 0.5f) else TagBlueBg.copy(alpha = 0.5f)
                                        isChecked -> if (isReserve) TagOrangeBg else TagBlueBg
                                        else -> Color.Transparent
                                    }
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(bgColor)
                                            .padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (multiSelectMode) {
                                            Checkbox(
                                                checked = isChecked,
                                                onCheckedChange = { checked ->
                                                    selectedProductIds = if (checked) {
                                                        selectedProductIds + product.id
                                                    } else {
                                                        selectedProductIds - product.id
                                                    }
                                                },
                                                colors = CheckboxDefaults.colors(checkedColor = accentColor)
                                            )
                                        }
                                        NetworkImage(
                                            url = product.imageUrl,
                                            contentDescription = null,
                                            modifier = Modifier
                                                .size(44.dp)
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(Color(0xFFF0F0F0)),
                                            contentScale = ContentScale.Crop
                                        )
                                        Spacer(Modifier.width(10.dp))
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                product.name,
                                                fontWeight = FontWeight.Medium,
                                                fontSize = 14.sp,
                                                color = OnBackground,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Row {
                                                Text(product.code, fontSize = 12.sp, color = TextSecondary)
                                                Text("  库存: ${product.quantity}", fontSize = 12.sp, color = accentColor)
                                            }
                                        }
                                        if (!multiSelectMode) {
                                            if (alreadyAdded) {
                                                Text("已添加", fontSize = 12.sp, color = Success, fontWeight = FontWeight.Medium)
                                            } else {
                                                TextButton(
                                                    onClick = { addProduct(product) },
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                                                ) {
                                                    Text("+ 添加", fontSize = 13.sp, color = accentColor, fontWeight = FontWeight.Medium)
                                                }
                                            }
                                        }
                                    }
                                    HorizontalDivider(
                                        modifier = Modifier.padding(horizontal = 12.dp),
                                        color = Divider
                                    )
                                }

                                if (multiSelectMode && selectedProductIds.isNotEmpty()) {
                                    Button(
                                        onClick = { addSelectedProducts() },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 12.dp, vertical = 8.dp),
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                                    ) {
                                        Icon(Icons.Default.Check, null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("确认添加 (${selectedProductIds.size})", fontSize = 14.sp)
                                    }
                                }
                            }
                        } else if (keyword.isBlank()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "输入关键词搜索商品",
                                    fontSize = 14.sp,
                                    color = TextSecondary
                                )
                            }
                        }
                    }
                }

                if (state.products.isNotEmpty()) {
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
                                Text(
                                    "已选商品（${state.products.size}）",
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 16.sp,
                                    color = OnBackground
                                )
                            }
                            Spacer(Modifier.height(8.dp))
                            state.products.forEach { item ->
                                Column {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        NetworkImage(
                                            url = item.imageUrl,
                                            contentDescription = null,
                                            modifier = Modifier
                                                .size(44.dp)
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(Color(0xFFF0F0F0)),
                                            contentScale = ContentScale.Crop
                                        )
                                        Spacer(Modifier.width(10.dp))
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                item.productName,
                                                fontWeight = FontWeight.Medium,
                                                fontSize = 14.sp,
                                                color = OnBackground,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Text(
                                                "${item.productCode}  库存: ${state.products.find { it.productId == item.productId }?.quantity ?: item.quantity}",
                                                fontSize = 12.sp,
                                                color = TextSecondary
                                            )
                                        }
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                                        ) {
                                            FilledIconButton(
                                                onClick = {
                                                    val q = item.quantity - 1
                                                    if (q > 0) viewModel.updateQuantity(item.productId, q)
                                                },
                                                modifier = Modifier.size(28.dp),
                                                colors = IconButtonDefaults.filledIconButtonColors(containerColor = accentBg)
                                            ) {
                                                Icon(Icons.Default.Remove, "减", modifier = Modifier.size(16.dp), tint = accentColor)
                                            }
                                            Text(
                                                "${item.quantity}",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 16.sp,
                                                color = OnBackground,
                                                modifier = Modifier.widthIn(min = 24.dp),
                                                textAlign = TextAlign.Center
                                            )
                                            FilledIconButton(
                                                onClick = { viewModel.updateQuantity(item.productId, item.quantity + 1) },
                                                modifier = Modifier.size(28.dp),
                                                colors = IconButtonDefaults.filledIconButtonColors(containerColor = accentBg)
                                            ) {
                                                Icon(Icons.Default.Add, "加", modifier = Modifier.size(16.dp), tint = accentColor)
                                            }
                                        }
                                        IconButton(
                                            onClick = { viewModel.removeProduct(item.productId) },
                                            modifier = Modifier.size(28.dp)
                                        ) {
                                            Icon(Icons.Default.Close, "移除", modifier = Modifier.size(18.dp), tint = Error)
                                        }
                                    }
                                    if (item != state.products.last()) {
                                        HorizontalDivider(color = Divider)
                                    }
                                }
                            }
                        }
                    }
                }

                if (isReserve) {
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = TagOrangeBg)
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
                            Text("💡", fontSize = 16.sp)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "预留后库存数量将锁定，取消预留后恢复",
                                fontSize = 13.sp,
                                color = TagOrangeText
                            )
                        }
                    }
                }
            }

            Surface(shadowElevation = 8.dp, color = Surface) {
                Column(modifier = Modifier.padding(16.dp)) {
                    if (state.error != null) {
                        Text(state.error!!, color = Error, fontSize = 13.sp)
                        Spacer(Modifier.height(8.dp))
                    }
                    Button(
                        onClick = { viewModel.create(selectedInventoryId, isReserve) },
                        enabled = state.products.isNotEmpty() && !state.loading && selectedInventoryId.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = accentColor)
                    ) {
                        if (state.loading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnPrimary, strokeWidth = 2.dp)
                        } else {
                            Text(
                                "确认新建${if (isReserve) "预留单" else "出库单"} (${state.products.size}件)",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CreateReserveScreen(
    currentInventoryId: String,
    onBack: () -> Unit
) {
    CreateOutboundScreen(currentInventoryId = currentInventoryId, onBack = onBack, isReserve = true)
}
