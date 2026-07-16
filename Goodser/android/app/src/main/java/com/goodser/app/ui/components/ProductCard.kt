package com.goodser.app.ui.components

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.goodser.app.data.model.Product
import com.goodser.app.ui.theme.*

@Composable
fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = product.imageUrl ?: product.images?.firstOrNull(),
            contentDescription = null,
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFFF0F0F0)),
            contentScale = ContentScale.Crop
        )
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(product.code, fontSize = 12.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                StatusTag(
                    text = statusLabel(product.statusCode),
                    bg = TagBlueBg, textColor = TagBlueText
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                product.name,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = OnBackground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 200.dp)
            )
            Spacer(Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "库存: ${product.quantity}",
                    fontSize = 14.sp,
                    color = Primary,
                    fontWeight = FontWeight.Medium
                )
                if (product.reservedQuantity > 0) {
                    Text(
                        " + ${product.reservedQuantity}",
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
