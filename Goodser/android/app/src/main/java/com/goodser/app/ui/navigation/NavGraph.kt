package com.goodser.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.ui.AppViewModel
import com.goodser.app.ui.auth.LoginScreen
import com.goodser.app.ui.auth.RegisterScreen
import com.goodser.app.ui.inbound.*
import com.goodser.app.ui.inventory.InventoryListScreen
import com.goodser.app.ui.inventory.ProductDetailScreen
import com.goodser.app.ui.inventory.ProductEditScreen
import com.goodser.app.ui.outbound.*
import com.goodser.app.ui.settings.*
import com.goodser.app.util.TokenManager
import kotlinx.coroutines.launch

@Composable
fun GoodserNavGraph() {
    val context = LocalContext.current
    val tokenManager = remember { TokenManager(context) }
    val navController = rememberNavController()
    val appViewModel: AppViewModel = viewModel()
    val appState by appViewModel.state.collectAsState()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    var startDest by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        RetrofitClient.init(tokenManager)
        val loggedIn = tokenManager.getAccessToken() != null
        val remembered = tokenManager.getRememberMe()
        startDest = if (loggedIn && remembered) Screen.Inventory.route else Screen.Login.route
    }

    val showBottomBar = currentRoute != null && bottomNavItems.any { it.screen.route == currentRoute }

    LaunchedEffect(Unit) {
        appViewModel.loadInventories()
    }

    val ready = startDest != null

    if (!ready) return

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = if (currentRoute == item.screen.route) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.label
                                )
                            },
                            label = { Text(item.label) },
                            selected = currentRoute == item.screen.route,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDest!!,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Inventory.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToRegister = {
                        navController.navigate(Screen.Register.route)
                    }
                )
            }
            composable(Screen.Register.route) {
                RegisterScreen(
                    onRegisterSuccess = {
                        navController.navigate(Screen.Inventory.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Inventory.route) {
                InventoryListScreen(
                    appViewModel = appViewModel,
                    onProductClick = { productId ->
                        navController.navigate(Screen.ProductDetail.createRoute(productId))
                    }
                )
            }
            composable(
                Screen.ProductDetail.route,
                arguments = listOf(navArgument("productId") { type = NavType.StringType })
            ) {
                val productId = it.arguments?.getString("productId") ?: ""
                ProductDetailScreen(
                    productId = productId,
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() },
                    onEdit = { id ->
                        navController.navigate(Screen.ProductEdit.createRoute(id))
                    }
                )
            }
            composable(
                Screen.ProductEdit.route,
                arguments = listOf(navArgument("productId") { type = NavType.StringType })
            ) {
                val rawId = it.arguments?.getString("productId") ?: Screen.ProductEdit.NEW_FLAG
                val productId = if (rawId == Screen.ProductEdit.NEW_FLAG) null else rawId
                ProductEditScreen(
                    productId = productId,
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Outbound.route) {
                OutboundListScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onOrderClick = { orderId ->
                        navController.navigate(Screen.OutboundDetail.createRoute(orderId))
                    },
                    onCreateOutbound = { navController.navigate(Screen.CreateOutbound.route) },
                    onCreateReserve = { navController.navigate(Screen.CreateReserve.route) }
                )
            }
            composable(
                Screen.OutboundDetail.route,
                arguments = listOf(navArgument("orderId") { type = NavType.StringType })
            ) {
                val orderId = it.arguments?.getString("orderId") ?: ""
                OutboundDetailScreen(
                    orderId = orderId,
                    onBack = { navController.popBackStack() },
                    inventoryId = appState.currentInventory?.id ?: ""
                )
            }
            composable(Screen.CreateOutbound.route) {
                CreateOutboundScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.CreateReserve.route) {
                CreateReserveScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Inbound.route) {
                InboundHomeScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onSingle = { navController.navigate(Screen.InboundSingle.route) },
                    onBatch = { navController.navigate(Screen.InboundBatch.route) },
                    onSearch = { navController.navigate(Screen.InboundSearch.route) },
                    onViewLogs = { navController.navigate(Screen.InboundLogs.route) },
                    onLogClick = { logId -> navController.navigate(Screen.InboundLogDetail.createRoute(logId)) }
                )
            }
            composable(Screen.InboundLogs.route) {
                InboundLogsScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() },
                    onLogClick = { logId ->
                        navController.navigate(Screen.InboundLogDetail.createRoute(logId))
                    }
                )
            }
            composable(
                Screen.InboundLogDetail.route,
                arguments = listOf(navArgument("logId") { type = NavType.StringType })
            ) {
                val logId = it.arguments?.getString("logId") ?: ""
                InboundLogDetailScreen(
                    logId = logId,
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.InboundSingle.route) {
                InboundSingleScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.InboundBatch.route) {
                InboundBatchScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.InboundSearch.route) {
                InboundSearchScreen(
                    currentInventoryId = appState.currentInventory?.id ?: "",
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Screen.Settings.route) {
                SettingsScreen(
                    onTags = { navController.navigate(Screen.Tags.route) },
                    onStatusCodes = { navController.navigate(Screen.StatusCodes.route) },
                    onServerConfig = { navController.navigate(Screen.ServerConfig.route) },
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
            composable(Screen.Tags.route) {
                TagManagementScreen(onBack = { navController.popBackStack() })
            }
            composable(Screen.StatusCodes.route) {
                StatusCodeScreen(onBack = { navController.popBackStack() })
            }
            composable(Screen.ServerConfig.route) {
                ServerConfigScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
