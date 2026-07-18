import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { safeHandler } from '../utils/safeHandler'
import { broadcast } from '../utils/broadcast'
import { CloudSyncService } from '../services/cloud/cloud-sync.service'
import type { CloudServiceType } from '../../shared/types'

export function registerCloudSyncIpc(cloudSyncService: CloudSyncService): void {
  ipcMain.handle(
    IPC_CHANNELS.CLOUD_CONNECT,
    safeHandler(IPC_CHANNELS.CLOUD_CONNECT, async (_event, service: CloudServiceType) => {
      const connection = await cloudSyncService.connect(service)
      const authInfo = cloudSyncService.getPendingAuthUrl()
      return {
        connection,
        authUrl: authInfo?.authUrl ?? null
      }
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_DISCONNECT,
    safeHandler(IPC_CHANNELS.CLOUD_DISCONNECT, async () => {
      await cloudSyncService.disconnect()
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_GET_STATUS,
    safeHandler(IPC_CHANNELS.CLOUD_GET_STATUS, async () => {
      return cloudSyncService.getStatus()
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_SYNC,
    safeHandler(IPC_CHANNELS.CLOUD_SYNC, async () => {
      return cloudSyncService.syncNow()
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_PULL,
    safeHandler(IPC_CHANNELS.CLOUD_PULL, async () => {
      return cloudSyncService.pullAll()
    })
  )
}
