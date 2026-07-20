package com.goodser.app.ui.inbound

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBackIos
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.model.InboundLog
import com.goodser.app.data.repository.InboundRepository
import com.goodser.app.ui.components.PullRefreshBox
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboundHomeScreen(
    currentInventoryId: String,
    onSingle: () -> Unit,
    onBatch: () -> Unit,
    onSearch: () -> Unit,
    onViewLogs: () -> Unit,
    onLogClick: ((String) -> Unit)? = null
) {
    val scope = rememberCoroutineScope()
    val repo = remember { InboundRepository() }
    var recentLogs by remember { mutableStateOf<List<InboundLog>>(emptyList()) }
    var refreshing by remember { mutableStateOf(false) }
    var refreshKey by remember { mutableIntStateOf(0) }

    fun loadRecentLogs() {
        if (currentInventoryId.isNotBlank()) {
            scope.launch {
                refreshing = true
                repo.loadLogs(currentInventoryId, pageSize = 5).fold(
                    onSuccess = { recentLogs = it.items },
                    onFailure = {}
                )
                refreshing = false
            }
        }
    }

    LaunchedEffect(Unit, refreshKey) {
        loadRecentLogs()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("入库") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary)
            )
        }
    ) { padding ->
        PullRefreshBox(
            refreshing = refreshing,
            onRefresh = { refreshKey++ },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(0.dp)) {
                item {
                    Card(modifier = Modifier.fillMaxWidth().padding(16.dp), shape = RoundedCornerShape(12.dp)) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("选择入库方式", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                            Spacer(Modifier.height(16.dp))
                            InboundMethodItem(icon = "📝", name = "单独新增", desc = "录入单个商品信息", onClick = onSingle)
                            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp), color = Background)
                            InboundMethodItem(icon = "📋", name = "批量新增", desc = "一次添加多个商品", onClick = onBatch)
                            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp), color = Background)
                            InboundMethodItem(icon = "🔍", name = "搜索导入", desc = "搜索已有商品导入新库存", onClick = onSearch)
                        }
                    }
                }

                item {
                    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), shape = RoundedCornerShape(12.dp)) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("最近入库记录", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary, modifier = Modifier.weight(1f))
                                TextButton(onClick = onViewLogs) { Text("查看全部", fontSize = 13.sp) }
                            }
                            if (recentLogs.isEmpty()) {
                                Text("暂无入库记录", fontSize = 14.sp, color = TextSecondary, modifier = Modifier.padding(vertical = 16.dp))
                            } else {
                                recentLogs.forEach { log ->
                                    LogItem(log = log, onClick = { onLogClick?.invoke(log.id) ?: onViewLogs() })
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InboundMethodItem(icon: String, name: String, desc: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 22.sp)
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(name, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary)
            Text(desc, fontSize = 12.sp, color = TextSecondary)
        }
        Icon(Icons.Default.ChevronRight, null, tint = TextSecondary, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun LogItem(log: InboundLog, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                when (log.type) { "single" -> "单独新增"; "batch" -> "批量新增"; "search" -> "搜索导入"; else -> log.type },
                fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary
            )
            val names = log.items?.take(3)?.map { it.productName }?.joinToString(", ") ?: ""
            if (names.isNotBlank()) Text(names, fontSize = 12.sp, color = TextSecondary, maxLines = 1)
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("+${log.items?.sumOf { it.quantity } ?: 0}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Success)
            Text(log.createdAt.take(16), fontSize = 11.sp, color = TextSecondary)
        }
        Icon(Icons.Default.ChevronRight, null, tint = TextSecondary, modifier = Modifier.size(18.dp).padding(start = 4.dp))
    }
}
