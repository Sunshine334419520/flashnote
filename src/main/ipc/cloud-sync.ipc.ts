import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { safeHandler } from '../utils/safeHandler'
import { broadcast } from '../utils/broadcast'
import { CloudSyncService } from '../services/cloud/cloud-sync.service'
import type { CloudServiceType } from '../../shared/types'

export function registerCloudSyncIpc(cloudSyncService: CloudSyncService): void {
  ipcMain.handle(
    IPC_CHANNELS.CLOUD_CONNECT,
    safeHandler('cloud:connect', async (_event, service: CloudServiceType) => {
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
    safeHandler('cloud:disconnect', async () => {
      await cloudSyncService.disconnect()
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_GET_STATUS,
    safeHandler('cloud:get-status', async () => {
      return cloudSyncService.getStatus()
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_SYNC,
    safeHandler('cloud:sync', async () => {
      return cloudSyncService.syncNow()
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.CLOUD_PULL,
    safeHandler('cloud:pull', async () => {
      return cloudSyncService.pullAll()
    })
  )
}
