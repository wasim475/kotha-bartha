package com.kothabarta.feature.home.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.kothabarta.core.network.social.PostDto
import com.kothabarta.core.network.social.ReactionTypes
import com.kothabarta.core.ui.components.AvatarImage
import com.kothabarta.core.ui.components.NetworkImage
import com.kothabarta.core.ui.theme.Spacing

private const val TRUNCATE_AT = 320

private val REACTION_EMOJI = mapOf(
    ReactionTypes.LIKE to "👍",
    ReactionTypes.LOVE to "❤️",
    ReactionTypes.HAHA to "😂",
    ReactionTypes.SAD to "😢",
    ReactionTypes.ANGRY to "😠",
)

@Composable
fun PostCard(
    post: PostDto,
    onOpenPost: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onReact: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenProfile(post.author.id) },
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                AvatarImage(avatarUrl = post.author.avatar?.secureUrl, initials = post.author.initials ?: post.author.fullName)
                Column(modifier = Modifier.padding(start = Spacing.sm)) {
                    Text(post.author.fullName, style = MaterialTheme.typography.titleMedium)
                    Text(post.createdAt, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Spacer(Spacing.sm)

            var expanded by remember(post.id) { mutableStateOf(false) }
            val showTruncated = !expanded && post.body.length > TRUNCATE_AT
            Text(
                text = if (showTruncated) post.body.take(TRUNCATE_AT) + "…" else post.body,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.clickable { onOpenPost(post.id) },
            )
            if (showTruncated) {
                Text(
                    "See more",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { expanded = true },
                )
            }

            if (post.media.isNotEmpty()) {
                Spacer(Spacing.sm)
                NetworkImage(
                    url = post.media.first().secureUrl,
                    contentDescription = "Post image",
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onOpenPost(post.id) },
                )
            }

            Spacer(Spacing.sm)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    ReactionTypes.ALL.forEach { type ->
                        val active = post.reaction == type
                        Text(
                            text = REACTION_EMOJI.getValue(type),
                            modifier = Modifier
                                .size(32.dp)
                                .clip(RoundedCornerShape(50))
                                .clickable { onReact(type) }
                                .padding(Spacing.xs)
                                .semantics { contentDescription = "React with $type" },
                            style = if (active) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
                Text(
                    "${post.likes} · ${post.comments} comments",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.clickable { onOpenPost(post.id) },
                )
            }
        }
    }
}

@Composable
private fun Spacer(size: androidx.compose.ui.unit.Dp) {
    androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(size))
}
