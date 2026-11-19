package com.mewki.reminders

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import app.tauri.PermissionState
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

private const val NOTIFICATIONS = "notifications"

@InvokeArg
class ConfigureArgs {
  lateinit var apiUrl: String
  lateinit var token: String
}

@TauriPlugin(permissions = [Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = NOTIFICATIONS)])
class RemindersPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun configure(invoke: Invoke) {
    val args = invoke.parseArgs(ConfigureArgs::class.java)
    Reminders.configure(activity, args.apiUrl, args.token)
    invoke.resolve()
  }

  @Command
  fun refresh(invoke: Invoke) {
    Reminders.refresh(activity)
    invoke.resolve()
  }

  @Command
  fun clear(invoke: Invoke) {
    Reminders.clear(activity)
    invoke.resolve()
  }

  @Command
  fun status(invoke: Invoke) {
    invoke.resolve(state())
  }

  @Command
  fun permit(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED
    ) {
      requestPermissionForAlias(NOTIFICATIONS, invoke, "permitted")
    } else {
      invoke.resolve(state())
    }
  }

  @PermissionCallback
  private fun permitted(invoke: Invoke) {
    invoke.resolve(state())
  }

  @Command
  fun settings(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      activity.startActivity(
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${activity.packageName}"))
      )
    }
    invoke.resolve()
  }

  @Command
  fun battery(invoke: Invoke) {
    activity.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    invoke.resolve()
  }

  private fun state(): JSObject {
    val permission = getPermissionState(NOTIFICATIONS)
    val notifications = when {
      NotificationManagerCompat.from(activity).areNotificationsEnabled() -> "granted"
      // Granted but off in system settings reads as denied: only the settings screen fixes it.
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        (permission == PermissionState.PROMPT || permission == PermissionState.PROMPT_WITH_RATIONALE) -> "prompt"
      else -> "denied"
    }
    return JSObject()
      .put("configured", Reminders.configured(activity))
      .put("notifications", notifications)
      .put("exact", Reminders.canExact(activity))
      .put("battery", Reminders.batteryOk(activity))
  }
}
