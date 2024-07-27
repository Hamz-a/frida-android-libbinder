# frida-android-libbinder

PoC Frida script to view Android libbinder traffic. The following links were a great source of inspiration and knowledge:
- https://www.blackhat.com/docs/eu-14/materials/eu-14-Artenstein-Man-In-The-Binder-He-Who-Controls-IPC-Controls-The-Droid.pdf
- https://sc1.checkpoint.com/downloads/Man-In-The-Binder-He-Who-Controls-IPC-Controls-The-Droid-wp.pdf
- https://www.synacktiv.com/posts/systems/binder-transactions-in-the-bowels-of-the-linux-kernel.html
- http://newandroidbook.com/files/Andevcon-Binder.pdf
- http://androidxref.com
- https://android.googlesource.com/platform/frameworks/native/+/jb-dev/libs/binder/

I wrote a blogpost which can be found here: [https://bhamza.me/blogpost/2019/04/24/Frida-Android-libbinder.html](https://bhamza.me/blogpost/2019/04/24/Frida-Android-libbinder.html)

## Usage

- Spawn app: `frida -U -l frida_android_libbinder.js -f com.example.app.id --no-pause`
- Attach to app: `frida -U -l frida_android_libbinder.js -n com.example.app.id --no-pause`

![preview][preview]

[preview]: /images/preview.png
