package com.mewki.app

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.TileService

// Quick Settings "Falar com a Mew": the same ACTION_ASSIST the assist gesture sends.
class MewTile : TileService() {
  override fun onClick() {
    unlockAndRun {
      val intent = Intent(Intent.ACTION_ASSIST, null, this, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startActivityAndCollapse(PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE))
      } else {
        @Suppress("DEPRECATION")
        startActivityAndCollapse(intent)
      }
    }
  }
}
