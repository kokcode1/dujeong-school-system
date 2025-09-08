// 데이터베이스 추상화 레이어
// Firebase가 설정되어 있으면 Firestore 사용, 아니면 localStorage 사용

class DatabaseManager {
    constructor() {
        this.cache = {}; // 로컬 캐시
        this.updateFirebaseStatus();
    }
    
    // Firebase 상태 업데이트
    updateFirebaseStatus() {
        this.isFirebaseEnabled = window.isFirebaseEnabled || false;
        this.db = window.db || null;
        console.log('🔍 Firebase 상태 확인:', {
            isFirebaseEnabled: this.isFirebaseEnabled,
            hasDb: !!this.db,
            windowVars: {
                isFirebaseEnabled: window.isFirebaseEnabled,
                db: !!window.db
            }
        });
    }

    // 컬렉션별 참조 생성
    getCollection(collectionName) {
        if (this.isFirebaseEnabled && this.db) {
            return this.db.collection(collectionName);
        }
        return null;
    }

    // 데이터 추가
    async addDocument(collectionName, data) {
        try {
            if (this.isFirebaseEnabled && this.db) {
                // Firestore에 저장
                const docRef = await this.getCollection(collectionName).add({
                    ...data,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ Firestore에 저장됨: ${collectionName}/${docRef.id}`);
                
                // 로컬 캐시도 업데이트
                this.updateLocalCache(collectionName);
                return docRef.id;
            } else {
                // localStorage에 저장 (기존 방식)
                const storageKey = collectionName;
                const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
                existing.push(data);
                localStorage.setItem(storageKey, JSON.stringify(existing));
                console.log(`💾 localStorage에 저장됨: ${collectionName}`);
                return Date.now().toString();
            }
        } catch (error) {
            console.error('데이터 저장 오류:', error);
            // Firestore 실패 시 localStorage로 폴백
            return this.addToLocalStorage(collectionName, data);
        }
    }

    // 데이터 조회
    async getDocuments(collectionName) {
        try {
            if (this.isFirebaseEnabled && this.db) {
                // Firestore에서 조회
                const snapshot = await this.getCollection(collectionName).orderBy('createdAt', 'desc').get();
                const documents = [];
                snapshot.forEach(doc => {
                    documents.push({
                        id: doc.id,
                        firestoreId: doc.id, // 삭제를 위한 별칭
                        ...doc.data()
                    });
                });
                
                // 로컬 캐시 업데이트
                this.cache[collectionName] = documents;
                return documents;
            } else {
                // localStorage에서 조회
                const data = JSON.parse(localStorage.getItem(collectionName) || '[]');
                return data;
            }
        } catch (error) {
            console.error('데이터 조회 오류:', error);
            // 캐시가 있으면 캐시 반환
            if (this.cache[collectionName]) {
                return this.cache[collectionName];
            }
            // localStorage에서 조회
            return JSON.parse(localStorage.getItem(collectionName) || '[]');
        }
    }

    // 데이터 삭제
    async deleteDocument(collectionName, docId, localData = null) {
        try {
            if (this.isFirebaseEnabled && this.db) {
                // Firestore에서 삭제
                await this.getCollection(collectionName).doc(docId).delete();
                console.log(`🗑️ Firestore에서 삭제됨: ${collectionName}/${docId}`);
                
                // 로컬 캐시 업데이트
                this.updateLocalCache(collectionName);
            } else {
                // localStorage에서 삭제 (기존 방식)
                if (localData) {
                    const storageKey = collectionName;
                    localStorage.setItem(storageKey, JSON.stringify(localData));
                }
                console.log(`💾 localStorage에서 삭제됨: ${collectionName}`);
            }
        } catch (error) {
            console.error('데이터 삭제 오류:', error);
            // localStorage로 폴백
            if (localData) {
                localStorage.setItem(collectionName, JSON.stringify(localData));
            }
        }
    }

    // 실시간 데이터 감지
    setupRealtimeListener(collectionName, callback) {
        if (this.isFirebaseEnabled && this.db) {
            return this.getCollection(collectionName)
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    const documents = [];
                    snapshot.forEach(doc => {
                        documents.push({
                            id: doc.id,
                            firestoreId: doc.id, // 삭제를 위한 별칭
                            ...doc.data()
                        });
                    });
                    
                    // 로컬 캐시 업데이트
                    this.cache[collectionName] = documents;
                    
                    // 콜백 실행
                    callback(documents);
                    console.log(`🔄 실시간 업데이트: ${collectionName} (${documents.length}개)`);
                }, (error) => {
                    console.error('실시간 리스너 오류:', error);
                });
        }
        return null;
    }

    // 로컬 캐시 업데이트
    async updateLocalCache(collectionName) {
        try {
            const documents = await this.getDocuments(collectionName);
            this.cache[collectionName] = documents;
        } catch (error) {
            console.error('캐시 업데이트 오류:', error);
        }
    }

    // localStorage 폴백
    addToLocalStorage(collectionName, data) {
        const existing = JSON.parse(localStorage.getItem(collectionName) || '[]');
        existing.push(data);
        localStorage.setItem(collectionName, JSON.stringify(existing));
        return Date.now().toString();
    }

    // 연결 상태 확인
    isConnected() {
        this.updateFirebaseStatus(); // 최신 상태로 업데이트
        return this.isFirebaseEnabled;
    }

    // 연결 상태 메시지
    getConnectionStatus() {
        if (this.isFirebaseEnabled) {
            return "🔥 Firebase 실시간 데이터베이스 연결됨";
        } else {
            return "💾 로컬 저장소 사용중 (데모 모드)";
        }
    }
}

// 전역 데이터베이스 매니저 인스턴스
let dbManager = null;

// DatabaseManager 초기화 함수
function initializeDatabaseManager() {
    if (!dbManager) {
        dbManager = new DatabaseManager();
        console.log('📦 DatabaseManager 초기화:', dbManager.isConnected() ? 'Firebase 연결됨' : 'localStorage 모드');
    }
    return dbManager;
}

// Firebase 로딩 완료 후 DatabaseManager 초기화
window.addEventListener('DOMContentLoaded', () => {
    // Firebase 초기화 완료까지 잠시 대기
    setTimeout(() => {
        initializeDatabaseManager();
    }, 500);
});

// dbManager 안전 접근 함수
function getDbManager() {
    if (!dbManager) {
        return initializeDatabaseManager();
    }
    return dbManager;
}