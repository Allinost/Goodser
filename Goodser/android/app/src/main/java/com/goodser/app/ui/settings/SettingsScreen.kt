package com.goodser.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.SyncAllResp
import com.goodser.app.data.repository.AuthRepository
import com.goodser.app.ui.SyncEventBus
import com.goodser.app.ui.theme.*
import com.goodser.app.util.TokenManager
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onTags: () -> Unit,
    onStatusCodes: () -> Unit,
    onServerConfig: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val tokenManager = remember { TokenManager(context) }
    val authRepo = remember { AuthRepository(tokenManager) }
    val username by tokenManager.usernameFlow.collectAsState(initial = null)
    var syncing by remember { mutableStateOf(false) }
    var syncError by remember { mutableStateOf<String?>(null) }
    val lastSyncTime by tokenManager.lastSyncTimeFlow.collectAsState(initial = null)
    var showSyncDetail by remember { mutableStateOf(false) }
    var syncDetailData by remember { mutableStateOf<Map<String, Any>?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("设置") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).background(Background).verticalScroll(rememberScrollState())
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(username ?: "未登录", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("点击管理您的账号", fontSize = 12.sp, color = TextSecondary)
                }
            }
            SettingsItem("标签管理", onClick = onTags)
            SettingsItem("状态编码管理", onClick = onStatusCodes)
            SettingsItem("服务器配置", onClick = onServerConfig)
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))

            SettingsItem("同步数据", subtitle = if (syncing) "同步中..." else "手动同步所有数据到本地",
                onClick = if (syncing) null else {
                    {
                        scope.launch {
                            syncing = true; syncError = null
                            try {
                                val resp = RetrofitClient.callWithFailover { it.syncAll() }
                                if (resp.code == 0 && resp.data != null) {
                                    val d = resp.data
                                    val timeStr = formatNow()
                                    tokenManager.saveLastSyncTime(timeStr)
                                    val detail = buildSyncDetail(timeStr, d)
                                    tokenManager.saveLastSyncDetail(detail)
                                    SyncEventBus.notifyRefresh()
                                } else {
                                    syncError = resp.message ?: "同步失败"
                                }
                            } catch (e: Exception) {
                                syncError = "同步失败: ${e.message}"
                            }
                            syncing = false
                        }
                    }
                }
            )
            if (syncing) {
                Row(modifier = Modifier.padding(horizontal = 32.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(6.dp))
                    Text("数据同步中，请稍候...", fontSize = 12.sp, color = TextSecondary)
                }
            }
            if (syncError != null) {
                Text(syncError!!, fontSize = 12.sp, color = Error, modifier = Modifier.padding(horizontal = 32.dp))
            }
            if (lastSyncTime != null) {
                SettingsItem("上次全量同步", subtitle = lastSyncTime, onClick = {
                    scope.launch {
                        val raw = tokenManager.getLastSyncDetail()
                        if (raw != null) {
                            try {
                                val json = JSONObject(raw)
                                syncDetailData = json.keys().asSequence().associateWith { json.get(it) }
                                showSyncDetail = true
                            } catch (_: Exception) {}
                        }
                    }
                })
            }

            SettingsItem("关于 Goodser", subtitle = "v1.0.0")
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = {
                    scope.launch {
                        authRepo.logout()
                        onLogout()
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Error),
                shape = RoundedCornerShape(8.dp)
            ) { Text("退出登录") }
            Spacer(Modifier.height(32.dp))
        }
    }

    if (showSyncDetail && syncDetailData != null) {
        AlertDialog(
            onDismissRequest = { showSyncDetail = false },
            title = { Text("全量同步详情", fontWeight = FontWeight.Bold) },
            text = {
                val data = syncDetailData ?: return@AlertDialog
                Column {
                    DetailRow("同步时间", (data["sync_time"] as? String) ?: "未知")
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    Text("汇总统计", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                    Spacer(Modifier.height(8.dp))
                    DetailRow("库存目录", "${(data["inventories"] as? Number)?.toInt() ?: 0} 个")
                    DetailRow("商品总数", "${(data["products"] as? Number)?.toInt() ?: 0} 个")
                    DetailRow("出库单", "${(data["orders"] as? Number)?.toInt() ?: 0} 个")
                    DetailRow("入库日志", "${(data["logs"] as? Number)?.toInt() ?: 0} 条")
                    DetailRow("标签", "${(data["tags"] as? Number)?.toInt() ?: 0} 个")
                    DetailRow("状态编码", "${(data["status_codes"] as? Number)?.toInt() ?: 0} 个")
                }
            },
            confirmButton = { TextButton(onClick = { showSyncDetail = false }) { Text("关闭") } },
            shape = RoundedCornerShape(12.dp)
        )
    }
}

private fun buildSyncDetail(timeStr: String, data: SyncAllResp): String {
    val json = JSONObject()
    json.put("sync_time", timeStr)
    json.put("inventories", data.inventories?.size ?: 0)
    json.put("products", data.products?.values?.sumOf { it.size } ?: 0)
    json.put("orders", data.outboundOrders?.values?.sumOf { it.size } ?: 0)
    json.put("logs", data.inboundLogs?.values?.sumOf { it.size } ?: 0)
    json.put("tags", data.tags?.size ?: 0)
    json.put("status_codes", data.statusCodes?.size ?: 0)
    return json.toString()
}

private fun formatNow(): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
    return sdf.format(Date())
}

@Composable
fun SettingsItem(title: String, subtitle: String? = null, onClick: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp)
            subtitle?.let { Text(it, fontSize = 12.sp, color = TextSecondary) }
        }
        if (onClick != null) {
            Icon(Icons.Default.ChevronRight, ">", tint = TextSecondary)
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 13.sp, color = TextSecondary)
        Text(value, fontSize = 13.sp, color = OnBackground, fontWeight = FontWeight.Medium)
    }
}