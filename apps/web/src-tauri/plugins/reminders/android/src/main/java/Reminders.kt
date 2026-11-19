package com.mewki.reminders

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.text.format.DateFormat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Date
import java.util.TimeZone
import java.util.concurrent.TimeUnit

object Reminders {
  private const val CHANNEL = "reminders"
  private const val PERIODIC = "reminders.periodic"
  private const val ONCE = "reminders.once"
  private const val TOKEN = "token"
  private const val API = "apiUrl"
  private const val FEED = "feed"

  // ponytail: plain private prefs hold the feed token (read-only, revoked on sign-out); move it to
  // EncryptedSharedPreferences or the Keystore if it ever grants more.
  fun prefs(ctx: Context) = ctx.getSharedPreferences("mewki.reminders", Context.MODE_PRIVATE)

  fun configured(ctx: Context) = prefs(ctx).getString(TOKEN, null) != null

  private fun online() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

  fun configure(ctx: Context, apiUrl: String, token: String) {
    prefs(ctx).edit().putString(API, apiUrl.trimEnd('/')).putString(TOKEN, token).commit()
    val periodic = PeriodicWorkRequest.Builder(SyncWorker::class.java, 1, TimeUnit.HOURS)
      .setConstraints(online()).build()
    WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, periodic)
    refresh(ctx, 0)
  }

  // The delay lets a task write still in flight land before the feed is read.
  fun refresh(ctx: Context, delaySeconds: Long = 3) {
    if (!configured(ctx)) return
    val once = OneTimeWorkRequest.Builder(SyncWorker::class.java)
      .setConstraints(online()).setInitialDelay(delaySeconds, TimeUnit.SECONDS).build()
    WorkManager.getInstance(ctx).enqueueUniqueWork(ONCE, ExistingWorkPolicy.REPLACE, once)
  }

  @Synchronized
  fun clear(ctx: Context) {
    val feed = feed(ctx)
    for (i in 0 until feed.length()) cancel(ctx, feed.getJSONObject(i).getString("id"))
    WorkManager.getInstance(ctx).run {
      cancelUniqueWork(PERIODIC)
      cancelUniqueWork(ONCE)
    }
    prefs(ctx).edit().clear().commit()
  }

  fun feed(ctx: Context) = JSONArray(prefs(ctx).getString(FEED, "[]"))

  // Applies a fetched feed unless the token it was fetched with was cleared or replaced meanwhile.
  @Synchronized
  fun apply(ctx: Context, token: String, next: JSONArray) {
    if (prefs(ctx).getString(TOKEN, null) != token) return
    val keep = (0 until next.length()).map { next.getJSONObject(it).getString("id") }.toSet()
    val old = feed(ctx)
    for (i in 0 until old.length()) {
      val id = old.getJSONObject(i).getString("id")
      if (id !in keep) cancel(ctx, id)
    }
    prefs(ctx).edit().putString(FEED, next.toString()).commit()
    arm(ctx, next)
  }

  fun arm(ctx: Context, feed: JSONArray) {
    val alarms = ctx.getSystemService(AlarmManager::class.java)
    val exact = canExact(ctx)
    val now = System.currentTimeMillis()
    for (i in 0 until feed.length()) {
      val item = feed.getJSONObject(i)
      val fireAt = item.getLong("fireAt")
      if (fireAt <= now) continue
      val intent = intent(ctx, item.getString("id"))
        .putExtra("title", item.getString("title"))
        .putExtra("at", item.getLong("at"))
      val pending = PendingIntent.getBroadcast(
        ctx, item.getString("id").hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      if (exact) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pending)
      else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pending)
    }
  }

  // OEMs that kill background work of apps left battery-optimized (dontkillmyapp.com).
  private val aggressive = setOf("xiaomi", "redmi", "poco", "samsung", "huawei", "honor", "oneplus", "oppo", "realme", "vivo")

  // True when nothing is likely to hold the alarms back.
  fun batteryOk(ctx: Context) =
    Build.MANUFACTURER.lowercase() !in aggressive ||
      ctx.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(ctx.packageName)

  fun canExact(ctx: Context) =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      ctx.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

  // The data URI keeps two ids distinct as PendingIntents even when their hash codes collide.
  private fun intent(ctx: Context, id: String) =
    Intent(ctx, AlarmReceiver::class.java).setData(Uri.fromParts("mewki-reminder", id, null))

  private fun cancel(ctx: Context, id: String) {
    val pending = PendingIntent.getBroadcast(
      ctx, id.hashCode(), intent(ctx, id),
      PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    ) ?: return
    ctx.getSystemService(AlarmManager::class.java).cancel(pending)
    pending.cancel()
  }

  @SuppressLint("MissingPermission")
  fun notify(ctx: Context, id: String, title: String, at: Long) {
    val manager = NotificationManagerCompat.from(ctx)
    if (!manager.areNotificationsEnabled()) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      ctx.getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL, ctx.getString(R.string.reminders_channel), NotificationManager.IMPORTANCE_HIGH)
      )
    }
    // The deep-link plugin routes it (`parseOpenLink`): the agenda opens on the task's day.
    val open = Intent(Intent.ACTION_VIEW, Uri.parse("mewki://open/dashboard?at=$at")).setPackage(ctx.packageName)
    val tap = PendingIntent.getActivity(
      ctx, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val time = DateFormat.getTimeFormat(ctx).format(Date(at))
    val notification = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_reminder)
      .setContentTitle(title)
      .setContentText(ctx.getString(R.string.reminders_body, time))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setContentIntent(tap)
      .setAutoCancel(true)
      .build()
    manager.notify(id.hashCode(), notification)
  }
}

class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
  override fun doWork(): Result {
    val ctx = applicationContext
    val prefs = Reminders.prefs(ctx)
    val api = prefs.getString("apiUrl", null) ?: return Result.success()
    val token = prefs.getString("token", null) ?: return Result.success()
    val tz = URLEncoder.encode(TimeZone.getDefault().id, "UTF-8")
    return try {
      val conn = URL("$api/reminders/feed?tz=$tz").openConnection() as HttpURLConnection
      try {
        conn.connectTimeout = 15_000
        conn.readTimeout = 15_000
        conn.setRequestProperty("Authorization", "Bearer $token")
        when (conn.responseCode) {
          200 -> {
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            Reminders.apply(ctx, token, JSONObject(body).getJSONArray("reminders"))
            Result.success()
          }
          // Dead token (signed out, account deleted): nothing of this login may stay armed.
          401 -> {
            if (prefs.getString("token", null) == token) Reminders.clear(ctx)
            Result.success()
          }
          else -> Result.retry()
        }
      } finally {
        conn.disconnect()
      }
    } catch (e: Exception) {
      Result.retry()
    }
  }
}

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.data?.schemeSpecificPart ?: return
    val title = intent.getStringExtra("title") ?: return
    Reminders.notify(ctx, id, title, intent.getLongExtra("at", 0))
  }
}

// Boot drops every alarm; an update, a clock or zone change, or a new exact-alarm grant can make
// them stale. Re-arm offline first, then fetch.
class RearmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    if (!Reminders.configured(ctx)) return
    Reminders.arm(ctx, Reminders.feed(ctx))
    Reminders.refresh(ctx)
  }
}
