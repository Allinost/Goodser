package com.goodser.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.outlined.Assignment
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector? = null) {
    object Login : Screen("login", "登录")
    object Register : Screen("register", "注册")
    object Inventory : Screen("inventory", "库存", Icons.Filled.Inventory2)
    object ProductDetail : Screen("product_detail/{productId}", "商品详情") {
        fun createRoute(productId: String) = "product_detail/$productId"
    }
    object ProductEdit : Screen("product_edit/{productId}", "编辑商品") {
        fun createRoute(productId: String) = "product_edit/$productId"
        const val NEW_FLAG = "new"
    }
    object Outbound : Screen("outbound", "出库", Icons.AutoMirrored.Filled.Logout)
    object InboundLogDetail : Screen("inbound_log_detail/{logId}", "入库单详情") {
        fun createRoute(logId: String) = "inbound_log_detail/$logId"
    }
    object OutboundDetail : Screen("outbound_detail/{orderId}", "出库单详情") {
        fun createRoute(orderId: String) = "outbound_detail/$orderId"
    }
    object CreateOutbound : Screen("create_outbound", "新建出库单")
    object CreateReserve : Screen("create_reserve", "新建预留单")
    object Inbound : Screen("inbound", "入库", Icons.AutoMirrored.Filled.Assignment)
    object InboundSingle : Screen("inbound_single", "单独入库")
    object InboundBatch : Screen("inbound_batch", "批量入库")
    object InboundSearch : Screen("inbound_search", "搜索导入")
    object InboundLogs : Screen("inbound_logs", "入库记录")
    object Settings : Screen("settings", "设置", Icons.Filled.Settings)
    object Tags : Screen("tags", "标签管理")
    object StatusCodes : Screen("status_codes", "状态编码管理")
    object ServerConfig : Screen("server_config", "服务器配置")
}

data class BottomNavItem(
    val screen: Screen,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val label: String
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Inventory, Icons.Filled.Inventory2, Icons.Outlined.Inventory2, "库存"),
    BottomNavItem(Screen.Outbound, Icons.AutoMirrored.Filled.Logout, Icons.AutoMirrored.Outlined.Logout, "出库"),
    BottomNavItem(Screen.Inbound, Icons.AutoMirrored.Filled.Assignment, Icons.AutoMirrored.Outlined.Assignment, "入库"),
    BottomNavItem(Screen.Settings, Icons.Filled.Settings, Icons.Outlined.Settings, "设置")
)
