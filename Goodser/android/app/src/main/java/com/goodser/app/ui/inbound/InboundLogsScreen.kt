package com.goodser.app.ui.inbound

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.goodser.app.ui.SyncEventBus
import com.goodser.app.ui.components.PullRefreshBox
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboundLogsScreen(
    currentInventoryId: String,
    onBack: () -> Unit,
    onLogClick: ((String) -> Unit)? = null
) {
    val scope = rememberCoroutineScope()
    val repo = remember { InboundRepository() }
    var logs by remember { mutableStateOf<List<InboundLog>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        SyncEventBus.events.collect { refreshKey++ }
    }

    LaunchedEffect(currentInventoryId, refreshKey) {
        if (currentInventoryId.isNotBlank()) {
            loading = true
            repo.loadLogs(currentInventoryId, pageSize = 50).fold(
                onSuccess = { resp -> logs = resp.items; loading = false },
                onFailure = { error = it.message; loading = false }
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("入库记录") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary)
            )
        }
    ) { padding ->
        PullRefreshBox(
            refreshing = loading,
            onRefresh = { refreshKey++ },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            if (loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else if (logs.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(if (error != null) error!! else "暂无入库记录", color = TextSecondary)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(logs, key = { it.id }) { log ->
                        Card(
                            modifier = Modifier.fillMaxWidth().clickable { onLogClick?.invoke(log.id) },
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Surface(shape = RoundedCornerShape(4.dp), color = TagBlueBg) {
                                            Text(
                                                when (log.type) { "single" -> "单品入库"; "batch" -> "批量入库"; "search" -> "搜索导入"; else -> log.type },
                                                fontSize = 11.sp, color = TagBlueText, fontWeight = FontWeight.Medium,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                            )
                                        }
                                        log.orderNo?.let {
                                            Spacer(Modifier.width(8.dp))
                                            Text(it, fontSize = 13.sp, color = TextSecondary)
                                        }
                                    }
                                    val names = log.items?.take(3)?.map { it.productName }?.joinToString(", ") ?: ""
                                    if (names.isNotBlank()) {
                                        Spacer(Modifier.height(4.dp))
                                        Text(names, fontSize = 13.sp, color = OnBackground, maxLines = 1)
                                    }
                                    Spacer(Modifier.height(4.dp))
                                    Text(log.createdAt.take(16), fontSize = 12.sp, color = TextSecondary)
                                }
                                val logItems = log.items
                                if (logItems != null && logItems.isNotEmpty()) {
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text("+${logItems.sumOf { it.quantity }}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Success)
                                        Text("${logItems.size}种", fontSize = 11.sp, color = TextSecondary)
                                    }
                                }
                                Icon(Icons.Default.ChevronRight, null, tint = TextSecondary, modifier = Modifier.size(20.dp).padding(start = 4.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}
