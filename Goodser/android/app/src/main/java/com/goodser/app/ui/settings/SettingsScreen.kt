package com.goodser.app.ui.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.platform.LocalContext
import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.repository.AuthRepository
import com.goodser.app.ui.theme.*
import com.goodser.app.util.TokenManager
import kotlinx.coroutines.launch
import androidx.compose.foundation.background

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
    var syncResult by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("设置") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).background(Background)) {
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
            SettingsItem("同步数据", subtitle = "手动同步所有数据到本地",
                onClick = {
                    scope.launch {
                        syncing = true; syncResult = null
                        try {
                            val resp = RetrofitClient.goodserApi.syncAll()
                            syncResult = if (resp.code == 0) "同步成功" else "同步失败: ${resp.message}"
                        } catch (e: Exception) {
                            syncResult = "同步失败: ${e.message}"
                        }
                        syncing = false
                    }
                }
            )
            if (syncing) {
                Row(modifier = Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text("同步中...", fontSize = 13.sp, color = TextSecondary)
                }
            }
            if (syncResult != null) {
                Text(syncResult!!, fontSize = 13.sp, color = if (syncResult!!.startsWith("同步成功")) Success else Error, modifier = Modifier.padding(horizontal = 16.dp))
            }
            SettingsItem("关于 Goodser", subtitle = "v1.0.0")
            Spacer(Modifier.weight(1f))
            Button(
                onClick = {
                    scope.launch {
                        authRepo.logout()
                        onLogout()
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(16.dp).height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Error),
                shape = RoundedCornerShape(8.dp)
            ) { Text("退出登录") }
        }
    }
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
