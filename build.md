## Android 빌드 (Windows PowerShell)

프로젝트 루트(`package.json`이 있는 폴더)에서 실행합니다.

### 개발용 Debug

Debug APK는 JavaScript 번들을 포함하지 않으므로 Metro 개발 서버가 실행 중이어야 앱이 열립니다. 기기에서 실행할 때는 USB 연결 후 포트도 전달합니다.

터미널 1:

```powershell
npx expo start
```

터미널 2:

```powershell
adb reverse tcp:8081 tcp:8081
npx expo prebuild --platform android
Set-Location android
.\gradlew.bat installDebug
```

Debug APK 파일만 만들려면 `installDebug` 대신 `assembleDebug`를 사용합니다. APK 위치는 `android\app\build\outputs\apk\debug\app-debug.apk`입니다. 이 APK를 Metro 없이 단독 실행하면 시작 화면에서 멈춘 것처럼 보일 수 있습니다.

### 단독 실행용 APK

다른 경로로 복사하거나 Metro 없이 설치해 실행할 APK는 Release 빌드로 만듭니다.

```powershell
npx expo prebuild --platform android
Set-Location android
.\gradlew.bat assembleRelease
```

APK 위치는 `android\app\build\outputs\apk\release\app-release.apk`입니다.

### Google Play용 AAB

```powershell
npx expo prebuild --platform android
Set-Location android
.\gradlew.bat bundleRelease
```

AAB 위치는 `android\app\build\outputs\bundle\release\app-release.aab`입니다. Play Store 배포 전에는 별도의 Release 서명 설정이 필요합니다.