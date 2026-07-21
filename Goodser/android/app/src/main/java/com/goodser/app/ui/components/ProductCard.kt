package com.goodser.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.model.Product
import com.goodser.app.ui.theme.*

@Composable
fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.fillMaxWidth().background(Surface)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
        NetworkImage(
            url = product.imageUrl?.ifBlank { null } ?: product.images?.firstOrNull(),
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            contentScale = ContentScale.Crop
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(product.code, fontSize = 12.sp, color = TextSecondary, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f))
                StatusTag(
                    text = statusLabel(product.statusCode),
                    bg = TagBlueBg, textColor = TagBlueText
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                product.name,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = OnBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(4.dp))
            if (product.expectedPrice != null) {
                Text(
                    "¥${"%.2f".format(product.expectedPrice)}",
                    fontSize = 13.sp,
                    color = TextSecondary,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(Modifier.height(2.dp))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "库存: ${product.quantity}",
                    fontSize = 14.sp,
                    color = Primary,
                    fontWeight = FontWeight.Medium
                )
                if (product.reservedQuantity > 0) {
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "+${product.reservedQuantity}",
                        fontSize = 14.sp,
                        color = Warning,
                        fontWeight = FontWeight.Medium
                    )
                }
                Spacer(Modifier.weight(1f))
                if (!product.storageLocation.isNullOrBlank()) {
                    Text(product.storageLocation, fontSize = 12.sp, color = TextSecondary)
                }
            }
        }
    }
    HorizontalDivider(color = Divider, thickness = 0.5.dp)
}
}

@Composable
fun StatusTag(text: String, bg: Color, textColor: Color) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = textColor,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .background(bg, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp)
    )
}

fun statusLabel(code: String): String = when (code) {
    "A" -> "在库"
    "B" -> "待售"
    "C" -> "已售"
    "D" -> "报废"
    else -> code
}
