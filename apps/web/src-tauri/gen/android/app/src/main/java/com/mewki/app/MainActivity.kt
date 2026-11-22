package com.mewki.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    if (savedInstanceState == null) intent = assistToView(intent)
    super.onCreate(savedInstanceState)
    // Edge-to-edge on SDK 35 no longer resizes the window for the keyboard, so the WebView panned
    // the page up instead: shrink it by the keyboard's height, and the web layout fits above it.
    ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, insets ->
      view.setPadding(0, 0, 0, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
      insets
    }
  }

  override fun onNewIntent(intent: Intent) {
    val view = assistToView(intent)
    setIntent(view)
    super.onNewIntent(view)
  }

  // The assist gesture, the "Falar com a Mew" shortcut and the tile send ACTION_ASSIST; the
  // deep-link plugin only reads VIEW, so it becomes a link the web opens as the Mew listening.
  // Reopened from Recents, the old ASSIST intent comes back: left as is, so a plain launch.
  private fun assistToView(intent: Intent): Intent {
    if (intent.action != Intent.ACTION_ASSIST) return intent
    if ((intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return intent
    return Intent(Intent.ACTION_VIEW, Uri.parse("mewki://open/dashboard?mew=voice"))
  }
}
