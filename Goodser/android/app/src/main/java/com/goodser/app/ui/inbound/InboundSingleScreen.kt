package com.goodser.app.ui.inbound

import androidx.compose.foundation.layout.ExperimentalLayoutApi

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.InboundRepository
import com.goodser.app.data.repository.ProductRepository
import com.goodser.app.data.repository.StatusCodeRepository
import com.goodser.app.data.repository.TagRepository
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

private val ZONES = listOf("A", "B", "C", "D", "E", "F", "G", "H")

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)

@Composable
fun InboundSingleScreen(
    currentInventoryId: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val inboundRepo = remember { InboundRepository() }
    val productRepo = remember { ProductRepository() }
    val tagRepo = remember { TagRepository() }
    val statusCodeRepo = remember { StatusCodeRepository() }

    var name by remember { mutableStateOf("") }
    var images by remember { mutableStateOf<List<String>>(emptyList()) }
    var mainZone by remember { mutableStateOf("A") }
    var subZone by remember { mutableStateOf("A") }
    var statusCode by remember { mutableStateOf("A") }
    var quantity by remember { mutableStateOf("") }
    var originalPrice by remember { mutableStateOf("") }
    var marketPrice by remember { mutableStateOf("") }
    var expectedPrice by remember { mutableStateOf("") }
    var storageLocation by remember { mutableStateOf("") }
    var remark by remember { mutableStateOf("") }
    var selectedTagIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var availableTags by remember { mutableStateOf<List<GoodserTag>>(emptyList()) }
    var statusCodes by remember { mutableStateOf<List<StatusCode>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf(false) }

    var mainZoneExpanded by remember { mutableStateOf(false) }
    var subZoneExpanded by remember { mutableStateOf(false) }
    var statusCodeExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        tagRepo.loadTags().fold(onSuccess = { availableTags = it }, onFailure = {})
        statusCodeRepo.loadStatusCodes().fold(onSuccess = { statusCodes = it }, onFailure = {})
    }
    LaunchedEffect(success) { if (success) onBack() }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            images = listOf(it.toString())
        }
    }

    val previewCode = if (mainZone.isNotBlank() && subZone.isNotBlank() && quantity.toIntOrNull() != null && quantity.toInt() > 0) {
        "$mainZone-$subZone-XXXX-${quantity}-$statusCode"
    } else ""

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("新增入库") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp).background(Background)
            ) {
                Text("入库目录", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                Text(currentInventoryId.ifBlank { "未选择" }, fontSize = 13.sp, color = TextSecondary)
                Spacer(Modifier.height(16.dp))

                Card(shape = RoundedCornerShape(12.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("商品图片", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        if (images.isNotEmpty()) Text("（${images.size}张，首图为主图）", fontSize = 12.sp, color = TextSecondary)
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            images.forEachIndexed { index, url ->
                                Box(modifier = Modifier.size(80.dp)) {
                                    AsyncImage(model = url, contentDescription = null, modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
                                    IconButton(onClick = { images = images.toMutableList().also { list -> if (index < list.size) list.removeAt(index) } }, modifier = Modifier.align(Alignment.TopEnd).size(20.dp)) {
                                        Icon(Icons.Default.Close, "删除", tint = Error, modifier = Modifier.size(14.dp))
                                    }
                                }
                            }
                            if (images.size < 9) {
                                Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(8.dp)).border(1.dp, TextSecondary.copy(alpha = 0.3f), RoundedCornerShape(8.dp)).clickable { imagePicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Icon(Icons.Default.PhotoCamera, null, tint = TextSecondary, modifier = Modifier.size(24.dp))
                                        Text("添加图片", fontSize = 10.sp, color = TextSecondary)
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))

                Card(shape = RoundedCornerShape(12.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("商品名称 *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = originalPrice, onValueChange = { originalPrice = it }, label = { Text("原价") }, singleLine = true, modifier = Modifier.weight(1f))
                            OutlinedTextField(value = marketPrice, onValueChange = { marketPrice = it }, label = { Text("市场价") }, singleLine = true, modifier = Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(value = expectedPrice, onValueChange = { expectedPrice = it }, label = { Text("预期出售价") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(value = quantity, onValueChange = { quantity = it.filter { c -> c.isDigit() } }, label = { Text("库存数量 *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(value = storageLocation, onValueChange = { storageLocation = it }, label = { Text("仓储位置") }, placeholder = { Text("如: A区-1架-2层") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(value = remark, onValueChange = { remark = it }, label = { Text("备注信息") }, modifier = Modifier.fillMaxWidth().height(80.dp))
                    }
                }
                Spacer(Modifier.height(12.dp))

                Card(shape = RoundedCornerShape(12.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("分区与状态", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Spacer(Modifier.height(8.dp))

                        ExposedDropdownMenuBox(expanded = mainZoneExpanded, onExpandedChange = { mainZoneExpanded = it }) {
                            OutlinedTextField(value = mainZone, onValueChange = {}, readOnly = true, label = { Text("主分区 *") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mainZoneExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor())
                            ExposedDropdownMenu(expanded = mainZoneExpanded, onDismissRequest = { mainZoneExpanded = false }) {
                                ZONES.forEach { zone -> DropdownMenuItem(text = { Text(zone) }, onClick = { mainZone = zone; mainZoneExpanded = false }) }
                            }
                        }
                        Spacer(Modifier.height(8.dp))

                        ExposedDropdownMenuBox(expanded = subZoneExpanded, onExpandedChange = { subZoneExpanded = it }) {
                            OutlinedTextField(value = subZone, onValueChange = {}, readOnly = true, label = { Text("子分区 *") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = subZoneExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor())
                            ExposedDropdownMenu(expanded = subZoneExpanded, onDismissRequest = { subZoneExpanded = false }) {
                                ZONES.forEach { zone -> DropdownMenuItem(text = { Text(zone) }, onClick = { subZone = zone; subZoneExpanded = false }) }
                            }
                        }
                        Spacer(Modifier.height(8.dp))

                        ExposedDropdownMenuBox(expanded = statusCodeExpanded, onExpandedChange = { statusCodeExpanded = it }) {
                            OutlinedTextField(value = statusCodes.find { it.code == statusCode }?.let { "${it.code} - ${it.label}" } ?: statusCode, onValueChange = {}, readOnly = true, label = { Text("状态编码 *") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusCodeExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor())
                            ExposedDropdownMenu(expanded = statusCodeExpanded, onDismissRequest = { statusCodeExpanded = false }) {
                                statusCodes.forEach { sc -> DropdownMenuItem(text = { Text("${sc.code} - ${sc.label}") }, onClick = { statusCode = sc.code; statusCodeExpanded = false }) }
                            }
                        }

                        if (previewCode.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("生成编码: ", fontSize = 12.sp, color = TextSecondary)
                                Text(previewCode, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Primary)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))

                Card(shape = RoundedCornerShape(12.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("商品标签", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Spacer(Modifier.height(8.dp))
                        if (availableTags.isEmpty()) {
                            Text("暂无可用标签", fontSize = 13.sp, color = TextSecondary)
                        } else {
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                availableTags.forEach { tag ->
                                    val selected = selectedTagIds.contains(tag.id)
                                    FilterChip(
                                        selected = selected,
                                        onClick = {
                                            selectedTagIds = if (selected) selectedTagIds - tag.id else selectedTagIds + tag.id
                                        },
                                        label = { Text(tag.name) }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Surface(shadowElevation = 8.dp) {
                Column(modifier = Modifier.padding(16.dp)) {
                    if (error != null) { Text(error!!, color = Error, fontSize = 13.sp); Spacer(Modifier.height(8.dp)) }
                    Button(
                        onClick = {
                            if (currentInventoryId.isBlank()) return@Button
                            scope.launch {
                                loading = true; error = null
                                try {
                                    val qty = quantity.toIntOrNull() ?: 0
                                    if (name.isBlank()) { error = "请输入商品名称"; loading = false; return@launch }
                                    if (qty <= 0) { error = "请输入有效数量"; loading = false; return@launch }
                                    val seq = productRepo.allocateSeq(currentInventoryId, mainZone, subZone).getOrNull() ?: 1
                                    inboundRepo.single(InboundSingleReq(
                                        inventoryId = currentInventoryId, code = "----",
                                        mainZone = mainZone, subZone = subZone, seqNumber = seq,
                                        quantity = qty, statusCode = statusCode, name = name,
                                        originalPrice = originalPrice.toDoubleOrNull(), marketPrice = marketPrice.toDoubleOrNull(),
                                        expectedPrice = expectedPrice.toDoubleOrNull(), remark = remark.ifBlank { null },
                                        storageLocation = storageLocation.ifBlank { null },
                                        imageUrl = images.firstOrNull(), tags = selectedTagIds.ifEmpty { null }
                                    )).fold(
                                        onSuccess = { loading = false; success = true },
                                        onFailure = { loading = false; error = it.message }
                                    )
                                } catch (e: Exception) { loading = false; error = e.message }
                            }
                        },
                        enabled = !loading && name.isNotBlank() && currentInventoryId.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnPrimary)
                        else Text("确认入库")
                    }
                }
            }
        }
    }
}
