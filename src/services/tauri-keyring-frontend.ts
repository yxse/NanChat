import { invoke } from '@tauri-apps/api/core';

class KeyringService {
  static async saveSecret(service: string, username: string, password: string) {
    try {
      await invoke('save_secret', { service, username, password });
      console.log('Secret saved successfully');
    } catch (error) {
      console.error('Failed to save secret:', error);
    }
  }

  static async getSecret(service: string, username: string) {
    try {
      const secret = await invoke('get_secret', { service, username });
      return secret;
    } catch (error) {
      console.error('Failed to retrieve secret:', error);
      return null;
    }
  }

  static async deleteSecret(service: string, username: string) {
    try {
      await invoke('delete_secret', { service, username });
      console.log('Secret deleted successfully');
    } catch (error) {
      console.error('Failed to delete secret:', error);
    }
  }
}

export default KeyringService;
