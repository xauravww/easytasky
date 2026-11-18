import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store/useStore';
import {
  getGitHubConfig,
  saveGitHubConfig,
  clearGitHubConfig,
  getGoogleDriveConfig,
  saveGoogleDriveConfig,
  clearGoogleDriveConfig,
  testGitHubAuth,
  testGoogleDriveAuth,
  backupToGitHub,
  restoreFromGitHub,
  backupToGoogleDrive,
  restoreFromGoogleDrive,
  GitHubConfig,
  GoogleDriveConfig,
} from '../lib/cloudBackup';

interface BackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ visible, onClose }) => {
  const store = useStore();

  // Active integration tab
  const [activeTab, setActiveTab] = useState<'github' | 'gdrive'>('github');

  // GitHub State
  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('easytasky-backup');
  const [ghConfig, setGhConfig] = useState<GitHubConfig | null>(null);
  const [ghLoading, setGhLoading] = useState(false);

  // Google Drive State
  const [gdToken, setGdToken] = useState('');
  const [gdConfig, setGdConfig] = useState<GoogleDriveConfig | null>(null);
  const [gdLoading, setGdLoading] = useState(false);

  // General Action State
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (visible) {
      (async () => {
        try {
          const gh = await getGitHubConfig();
          const gd = await getGoogleDriveConfig();
          if (active) {
            if (gh) {
              setGhConfig(gh);
              setGhToken(gh.token);
              setGhRepo(gh.repo);
            } else {
              setGhConfig(null);
            }

            if (gd) {
              setGdConfig(gd);
              setGdToken(gd.accessToken);
            } else {
              setGdConfig(null);
            }
          }
        } catch {
          // ignore
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [visible]);

  // GitHub handlers
  const handleConnectGitHub = async () => {
    if (!ghToken.trim()) {
      Alert.alert('Required', 'Please enter your GitHub Personal Access Token (PAT).');
      return;
    }
    setGhLoading(true);
    try {
      const trimmedToken = ghToken.trim();
      const trimmedRepo = ghRepo.trim() || 'easytasky-backup';
      const user = await testGitHubAuth(trimmedToken);

      const newConfig: GitHubConfig = {
        token: trimmedToken,
        repo: trimmedRepo,
        owner: user.login,
        lastBackupAt: ghConfig?.lastBackupAt,
      };

      await saveGitHubConfig(newConfig);
      setGhConfig(newConfig);
      Alert.alert('Connected', `Authenticated as @${user.login}. Backup repository: ${trimmedRepo} (private).`);
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Unable to authenticate with GitHub.');
    } finally {
      setGhLoading(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    Alert.alert('Disconnect GitHub', 'Are you sure you want to disconnect GitHub?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearGitHubConfig();
          setGhConfig(null);
          setGhToken('');
        },
      },
    ]);
  };

  const handleBackupGitHub = async () => {
    if (!ghConfig) return;
    setActionLoading('backup-gh');
    try {
      const jsonData = await store.exportDataJson();
      const result = await backupToGitHub(ghConfig.token, ghConfig.repo, jsonData);

      const updatedConfig = { ...ghConfig, lastBackupAt: new Date().toISOString() };
      await saveGitHubConfig(updatedConfig);
      setGhConfig(updatedConfig);

      Alert.alert('Success', `Backup pushed to ${result.repo} (commit: ${result.sha.substring(0, 7)})`);
    } catch (err: any) {
      Alert.alert('Backup Failed', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreGitHub = async () => {
    if (!ghConfig) return;
    Alert.alert(
      'Restore from GitHub',
      'This will replace your current local data with the latest backup in your GitHub private repo. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('restore-gh');
            try {
              const dataStr = await restoreFromGitHub(ghConfig.token, ghConfig.repo);
              const res = await store.importDataJson(dataStr);
              if (res.success) {
                Alert.alert('Restored', 'Your data has been successfully restored from GitHub!');
              } else {
                Alert.alert('Restore Failed', res.error || 'Failed to parse backup.');
              }
            } catch (err: any) {
              Alert.alert('Restore Failed', err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  // Google Drive handlers
  const handleConnectDrive = async () => {
    if (!gdToken.trim()) {
      Alert.alert('Required', 'Please enter your Google OAuth / Service Account Access Token.');
      return;
    }
    setGdLoading(true);
    try {
      const trimmed = gdToken.trim();
      const user = await testGoogleDriveAuth(trimmed);
      const newConfig: GoogleDriveConfig = {
        accessToken: trimmed,
        userEmail: user.email || 'Connected User',
        lastBackupAt: gdConfig?.lastBackupAt,
      };

      await saveGoogleDriveConfig(newConfig);
      setGdConfig(newConfig);
      Alert.alert('Connected', `Authenticated Google Drive for ${newConfig.userEmail}`);
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Unable to authenticate with Google Drive.');
    } finally {
      setGdLoading(false);
    }
  };

  const handleDisconnectDrive = async () => {
    Alert.alert('Disconnect Google Drive', 'Are you sure you want to disconnect Google Drive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearGoogleDriveConfig();
          setGdConfig(null);
          setGdToken('');
        },
      },
    ]);
  };

  const handleBackupDrive = async () => {
    if (!gdConfig) return;
    setActionLoading('backup-gd');
    try {
      const jsonData = await store.exportDataJson();
      const result = await backupToGoogleDrive(gdConfig.accessToken, jsonData);

      const updatedConfig = { ...gdConfig, lastBackupAt: new Date().toISOString() };
      await saveGoogleDriveConfig(updatedConfig);
      setGdConfig(updatedConfig);

      Alert.alert('Success', `Backup saved to Google Drive (File ID: ${result.fileId})`);
    } catch (err: any) {
      Alert.alert('Backup Failed', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreDrive = async () => {
    if (!gdConfig) return;
    Alert.alert(
      'Restore from Google Drive',
      'This will replace your current local data with the latest backup in your Google Drive. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('restore-gd');
            try {
              const dataStr = await restoreFromGoogleDrive(gdConfig.accessToken);
              const res = await store.importDataJson(dataStr);
              if (res.success) {
                Alert.alert('Restored', 'Your data has been successfully restored from Google Drive!');
              } else {
                Alert.alert('Restore Failed', res.error || 'Failed to parse backup.');
              }
            } catch (err: any) {
              Alert.alert('Restore Failed', err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="cloud-done-outline" size={24} color="#6366f1" />
              <Text style={styles.title}>Cloud Backup & Restore</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Connect GitHub (Classic PAT) and/or Google Drive (OAuth / Service Account). You can connect either one or both!
          </Text>

          {/* Segmented Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'github' && styles.tabActive]}
              onPress={() => setActiveTab('github')}
            >
              <Ionicons
                name="logo-github"
                size={18}
                color={activeTab === 'github' ? '#6366f1' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, activeTab === 'github' && styles.tabTextActive]}>
                GitHub {ghConfig ? '✓' : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'gdrive' && styles.tabActive]}
              onPress={() => setActiveTab('gdrive')}
            >
              <Ionicons
                name="logo-google"
                size={18}
                color={activeTab === 'gdrive' ? '#6366f1' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, activeTab === 'gdrive' && styles.tabTextActive]}>
                Google Drive {gdConfig ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            {/* GITHUB TAB CONTENT */}
            {activeTab === 'github' && (
              <View style={styles.tabContent}>
                <View style={styles.infoBanner}>
                  <Ionicons name="information-circle-outline" size={20} color="#38bdf8" />
                  <Text style={styles.infoBannerText}>
                    Use a GitHub Classic Token with `repo` (Full control of private repositories) scope. EasyTasky will
                    automatically create and manage a unique private repository.
                  </Text>
                </View>

                {ghConfig ? (
                  <View style={styles.connectedCard}>
                    <View style={styles.connectedHeader}>
                      <View style={styles.statusDot} />
                      <Text style={styles.connectedUser}>Connected: @{ghConfig.owner}</Text>
                    </View>
                    <Text style={styles.connectedDetail}>Private Repo: {ghConfig.repo}</Text>
                    {ghConfig.lastBackupAt ? (
                      <Text style={styles.lastBackupText}>
                        Last backup: {new Date(ghConfig.lastBackupAt).toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={styles.lastBackupText}>No cloud backup taken yet</Text>
                    )}

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary, actionLoading === 'backup-gh' && styles.btnDisabled]}
                        onPress={handleBackupGitHub}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === 'backup-gh' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.btnText}>Backup Now</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary, actionLoading === 'restore-gh' && styles.btnDisabled]}
                        onPress={handleRestoreGitHub}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === 'restore-gh' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="cloud-download" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.btnText}>Restore</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.btnDisconnect} onPress={handleDisconnectGitHub}>
                      <Text style={styles.btnDisconnectText}>Disconnect GitHub</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.formContainer}>
                    <Text style={styles.label}>Personal Access Token (Classic)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      placeholderTextColor="#64748b"
                      value={ghToken}
                      onChangeText={setGhToken}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <Text style={styles.label}>Backup Repository Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="easytasky-backup"
                      placeholderTextColor="#64748b"
                      value={ghRepo}
                      onChangeText={setGhRepo}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary, ghLoading && styles.btnDisabled]}
                      onPress={handleConnectGitHub}
                      disabled={ghLoading}
                    >
                      {ghLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Authenticate & Connect</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* GOOGLE DRIVE TAB CONTENT */}
            {activeTab === 'gdrive' && (
              <View style={styles.tabContent}>
                <View style={styles.infoBanner}>
                  <Ionicons name="information-circle-outline" size={20} color="#38bdf8" />
                  <Text style={styles.infoBannerText}>
                    Provide a Google OAuth access token or Service Account token with Drive scope (`drive.file` / `drive`).
                    EasyTasky stores backups safely in your Drive.
                  </Text>
                </View>

                {gdConfig ? (
                  <View style={styles.connectedCard}>
                    <View style={styles.connectedHeader}>
                      <View style={styles.statusDot} />
                      <Text style={styles.connectedUser}>Connected: {gdConfig.userEmail || 'Google Drive'}</Text>
                    </View>
                    {gdConfig.lastBackupAt ? (
                      <Text style={styles.lastBackupText}>
                        Last backup: {new Date(gdConfig.lastBackupAt).toLocaleString()}
                      </Text>
                    ) : (
                      <Text style={styles.lastBackupText}>No cloud backup taken yet</Text>
                    )}

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary, actionLoading === 'backup-gd' && styles.btnDisabled]}
                        onPress={handleBackupDrive}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === 'backup-gd' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.btnText}>Backup Now</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary, actionLoading === 'restore-gd' && styles.btnDisabled]}
                        onPress={handleRestoreDrive}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === 'restore-gd' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="cloud-download" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.btnText}>Restore</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.btnDisconnect} onPress={handleDisconnectDrive}>
                      <Text style={styles.btnDisconnectText}>Disconnect Google Drive</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.formContainer}>
                    <Text style={styles.label}>OAuth / Service Account Token</Text>
                    <TextInput
                      style={[styles.input, { height: 70 }]}
                      placeholder="ya29.xxxxxxxxxxxxxxxxxxxx"
                      placeholderTextColor="#64748b"
                      value={gdToken}
                      onChangeText={setGdToken}
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary, gdLoading && styles.btnDisabled]}
                      onPress={handleConnectDrive}
                      disabled={gdLoading}
                    >
                      {gdLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Authenticate & Connect</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default BackupRestoreModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#334155',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#f8fafc',
  },
  scrollArea: {
    maxHeight: 400,
  },
  tabContent: {
    paddingVertical: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#0c4a6e25',
    borderColor: '#0284c7',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    gap: 8,
    alignItems: 'center',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#bae6fd',
    lineHeight: 16,
  },
  formContainer: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: -4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
    marginTop: 8,
  },
  btnSecondary: {
    backgroundColor: '#0ea5e9',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  connectedCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  connectedUser: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  connectedDetail: {
    fontSize: 13,
    color: '#94a3b8',
  },
  lastBackupText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btnDisconnect: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  btnDisconnectText: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '600',
  },
});
