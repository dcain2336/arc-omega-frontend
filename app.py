UTC     ] Logs for arcassistant.streamlit.app/
────────────────────────────────────────────────────────────────────────────────────────
[16:23:50] 🚀 Starting up repository: 'arc-mainframe', branch: 'main', main module: 'app.py'
[16:23:50] 🐙 Cloning repository...
[16:23:52] 🐙 Cloning into '/mount/src/arc-mainframe'...

[16:23:52] 🐙 Cloned repository!
[16:23:52] 🐙 Pulling code changes from Github...
[16:23:53] 📦 Processing dependencies...
[16:23:53] 📦 Apt dependencies were installed from /mount/src/arc-mainframe/packages.txt using apt-get.
Hit:1 http://deb.debian.org/debian bookworm InRelease
Get:2 http://deb.debian.org/debian bookworm-updates InRelease [55.4 kB]
Get:3 http://deb.debian.org/debian-security bookworm-security InRelease [48.0 kB]
Get:4 https://packages.microsoft.com/debian/11/prod bullseye InRelease [3650 B]
Get:5 http://deb.debian.org/debian-security bookworm-security/main amd64 Packages [289 kB]
Get:6 https://packages.microsoft.com/debian/11/prod bullseye/main arm64 Packages [60.7 kB]
Get:7 https://packages.microsoft.com/debian/11/prod bullseye/main amd64 Packages [215 kB]
Fetched 672 kB in 0s (1484 kB/s)
Reading package lists...[2025-12-03 16:23:54.957428] 
Reading package lists...[2025-12-03 16:23:55.548986] 
Building dependency tree...[2025-12-03 16:23:55.700877] 
Reading state information...[2025-12-03 16:23:55.701136] 
The following additional packages will be installed:
  alsa-topology-conf alsa-ucm-conf libasound2 libasound2-data libasound2-dev
  libjack-jackd2-0 libjack-jackd2-dev libopus0 libpkgconf3 libportaudio2
  libportaudiocpp0 libsamplerate0 pkg-config pkgconf pkgconf-bin
Suggested packages:
  libasound2-plugins alsa-utils libasound2-doc jackd2 opus-tools
  portaudio19-doc
The following NEW packages will be installed:
  alsa-topology-conf alsa-ucm-conf libasound2 libasound2-data libasound2-dev
  libjack-jackd2-0 libjack-jackd2-dev libopus0 libpkgconf3 libportaudio2
  libportaudiocpp0 libsamplerate0 pkg-config pkgconf pkgconf-bin
  portaudio19-dev
0 upgraded, 16 newly installed, 0 to remove and 1 not upgraded.
Need to get 2347 kB of archives.
After this operation, 7763 kB of additional disk space will be used.
Get:1 http://deb.debian.org/debian bookworm/main amd64 alsa-topology-conf all 1.2.5.1-2 [15.2 kB]
Get:2 http://deb.debian.org/debian bookworm/main amd64 libasound2-data all 1.2.8-1 [20.5 kB]
Get:3 http://deb.debian.org/debian bookworm/main amd64 libasound2 amd64 1.2.8-1+b1 [362 kB]
Get:4 http://deb.debian.org/debian bookworm/main amd64 alsa-ucm-conf all 1.2.8-1 [51.7 kB]
Get:5 http://deb.debian.org/debian bookworm/main amd64 libasound2-dev amd64 1.2.8-1+b1 [110 kB]
Get:6 http://deb.debian.org/debian bookworm/main amd64 libopus0 amd64 1.3.1-3 [195 kB]
Get:7 http://deb.debian.org/debian bookworm/main amd64 libsamplerate0 amd64 0.2.2-3 [952 kB]
Get:8 http://deb.debian.org/debian bookworm/main amd64 libjack-jackd2-0 amd64 1.9.21~dfsg-3 [281 kB]
Get:9 http://deb.debian.org/debian bookworm/main amd64 libpkgconf3 amd64 1.8.1-1 [36.1 kB]
Get:10 http://deb.debian.org/debian bookworm/main amd64 pkgconf-bin amd64 1.8.1-1 [29.5 kB]
Get:11 http://deb.debian.org/debian bookworm/main amd64 pkgconf amd64 1.8.1-1 [25.9 kB]
Get:12 http://deb.debian.org/debian bookworm/main amd64 pkg-config amd64 1.8.1-1 [13.7 kB]
Get:13 http://deb.debian.org/debian bookworm/main amd64 libjack-jackd2-dev amd64 1.9.21~dfsg-3 [59.7 kB]
Get:14 http://deb.debian.org/debian bookworm/main amd64 libportaudio2 amd64 19.6.0-1.2 [66.7 kB]
Get:15 http://deb.debian.org/debian bookworm/main amd64 libportaudiocpp0 amd64 19.6.0-1.2 [19.9 kB]
Get:16 http://deb.debian.org/debian bookworm/main amd64 portaudio19-dev amd64 19.6.0-1.2 [108 kB]
debconf: delaying package configuration, since apt-utils is not installed
Fetched 2347 kB in 0s (16.5 MB/s)
Selecting previously unselected package alsa-topology-conf.
(Reading database ... 
[2025-12-03 16:23:56.403340] (Reading database ... 5%
(Reading database ... 10%
(Reading database ... 15%
(Reading database ... 20%
(Reading database ... 25%
(Reading database ... 30%
(Reading database ... 35%
(Reading database ... 40%
(Reading database ... 45%
(Reading database ... 50%
(Reading database ... 55%
(Reading database ... 60%
(Reading database ... 65%
[2025-12-03 16:23:56.405909] (Reading database ... 70%
[2025-12-03 16:23:56.407010] (Reading database ... 75%
[2025-12-03 16:23:56.409118] (Reading database ... 80%
[2025-12-03 16:23:56.410696] (Reading database ... 85%
[2025-12-03 16:23:56.412249] (Reading database ... 90%
[2025-12-03 16:23:56.413551] (Reading database ... 95%
[2025-12-03 16:23:56.415625] (Reading database ... 100%
(Reading database ... 23153 files and directories currently installed.)
Preparing to unpack .../00-alsa-topology-conf_1.2.5.1-2_all.deb ...
Unpacking alsa-topology-conf (1.2.5.1-2) ...
Selecting previously unselected package libasound2-data.
Preparing to unpack .../01-libasound2-data_1.2.8-1_all.deb ...
Unpacking libasound2-data (1.2.8-1) ...
Selecting previously unselected package libasound2:amd64.
Preparing to unpack .../02-libasound2_1.2.8-1+b1_amd64.deb ...
Unpacking libasound2:amd64 (1.2.8-1+b1) ...
Selecting previously unselected package alsa-ucm-conf.
Preparing to unpack .../03-alsa-ucm-conf_1.2.8-1_all.deb ...
Unpacking alsa-ucm-conf (1.2.8-1) ...
Selecting previously unselected package libasound2-dev:amd64.
Preparing to unpack .../04-libasound2-dev_1.2.8-1+b1_amd64.deb ...
Unpacking libasound2-dev:amd64 (1.2.8-1+b1) ...
Selecting previously unselected package libopus0:amd64.
Preparing to unpack .../05-libopus0_1.3.1-3_amd64.deb ...
Unpacking libopus0:amd64 (1.3.1-3) ...
Selecting previously unselected package libsamplerate0:amd64.
Preparing to unpack .../06-libsamplerate0_0.2.2-3_amd64.deb ...
Unpacking libsamplerate0:amd64 (0.2.2-3) ...
Selecting previously unselected package libjack-jackd2-0:amd64.
Preparing to unpack .../07-libjack-jackd2-0_1.9.21~dfsg-3_amd64.deb ...
Unpacking libjack-jackd2-0:amd64 (1.9.21~dfsg-3) ...
Selecting previously unselected package libpkgconf3:amd64.
Preparing to unpack .../08-libpkgconf3_1.8.1-1_amd64.deb ...
Unpacking libpkgconf3:amd64 (1.8.1-1) ...
Selecting previously unselected package pkgconf-bin.
Preparing to unpack .../09-pkgconf-bin_1.8.1-1_amd64.deb ...
Unpacking pkgconf-bin (1.8.1-1) ...
Selecting previously unselected package pkgconf:amd64.
Preparing to unpack .../10-pkgconf_1.8.1-1_amd64.deb ...
Unpacking pkgconf:amd64 (1.8.1-1) ...
Selecting previously unselected package pkg-config:amd64.
Preparing to unpack .../11-pkg-config_1.8.1-1_amd64.deb ...
Unpacking pkg-config:amd64 (1.8.1-1) ...
Selecting previously unselected package libjack-jackd2-dev:amd64.
Preparing to unpack .../12-libjack-jackd2-dev_1.9.21~dfsg-3_amd64.deb ...
Unpacking libjack-jackd2-dev:amd64 (1.9.21~dfsg-3) ...
Selecting previously unselected package libportaudio2:amd64.
Preparing to unpack .../13-libportaudio2_19.6.0-1.2_amd64.deb ...
Unpacking libportaudio2:amd64 (19.6.0-1.2) ...
Selecting previously unselected package libportaudiocpp0:amd64.
Preparing to unpack .../14-libportaudiocpp0_19.6.0-1.2_amd64.deb ...
Unpacking libportaudiocpp0:amd64 (19.6.0-1.2) ...
Selecting previously unselected package portaudio19-dev:amd64.
Preparing to unpack .../15-portaudio19-dev_19.6.0-1.2_amd64.deb ...
Unpacking portaudio19-dev:amd64 (19.6.0-1.2) ...
Setting up libasound2-data (1.2.8-1) ...
Setting up libpkgconf3:amd64 (1.8.1-1) ...
Setting up libopus0:amd64 (1.3.1-3) ...
Setting up pkgconf-bin (1.8.1-1) ...
Setting up alsa-topology-conf (1.2.5.1-2) ...
Setting up libasound2:amd64 (1.2.8-1+b1) ...
Setting up libasound2-dev:amd64 (1.2.8-1+b1) ...
Setting up libsamplerate0:amd64 (0.2.2-3) ...
Setting up alsa-ucm-conf (1.2.8-1) ...
Setting up pkgconf:amd64 (1.8.1-1) ...
Setting up pkg-config:amd64 (1.8.1-1) ...
Setting up libjack-jackd2-0:amd64 (1.9.21~dfsg-3) ...
Setting up libportaudio2:amd64 (19.6.0-1.2) ...
Setting up libjack-jackd2-dev:amd64 (1.9.21~dfsg-3) ...
Setting up libportaudiocpp0:amd64 (19.6.0-1.2) ...
Setting up portaudio19-dev:amd64 (19.6.0-1.2) ...
Processing triggers for libc-bin (2.36-9+deb12u13) ...

──────────────────────────────────────── uv ───────────────────────────────────────────

Using uv pip install.
Using Python 3.13.9 environment at /home/adminuser/venv
Resolved 104 packages in 986ms
Prepared 104 packages in 3.62s
Installed 104 packages in 105ms
 + aiofiles==25.1.0
 + aiohappyeyeballs==2.6.1
 + aiohttp==3.13.2
 + aiohttp-retry==2.9.1
 + aiosignal==1.4.0[2025-12-03 16:24:03.367643] 
 + altair==5.5.0
 + annotated-types==0.7.0
 + anyio==4.12.0
 [2025-12-03 16:24:03.367828] + attrs==25.4.0
 + backoff==2.2.1
 + blinker==1.9.0
 + branca==0.8.2
 + cachetools==6.2.2
 + [2025-12-03 16:24:03.368055] certifi==2025.11.12
 + charset-normalizer==3.4.4
 + click==8.3.1
 + click-plugins==1.1.1.2
 + colorama==[2025-12-03 16:24:03.368288] 0.4.6
 + distro==1.9.0
 + dnspython==2.8.0
 + filelock==3.20.0
 + folium==0.20.0
 [2025-12-03 16:24:03.368530] + frozenlist==1.8.0
 + gitdb==4.0.12
 + gitpython==3.1.45
 + google-ai-generativelanguage==0.6.15
 + google-api-core==2.28.1
 + google-api-python-client==2.187.0
 + google-auth==2.43.0
 + google-auth-httplib2==0.2.1
 + google-generativeai==0.8.5
 + googleapis-common-protos==1.72.0
 + gql==4.0.0
 + graphql-core==3.2.7
 + groq==0.37.0
 + grpcio==1.76.0
 + grpcio-status==1.71.2
 + h11[2025-12-03 16:24:03.369139] ==0.16.0
 + httpcore==1.0.9
 + httplib2==0.31.0
 + httpx==0.28.1
 + idna==3.11
 + [2025-12-03 16:24:03.369331] jinja2==3.1.6
 + jiter==0.12.0
 + joblib==1.5.2
 + jsonschema==4.25.1
 + jsonschema-specifications==2025.9.1
 + kafka-python==2.3.0[2025-12-03 16:24:03.369463] 
 + markupsafe==3.0.3
 + multidict==6.7.0
 + narwhals==2.13.0
 + numpy==2.3.5
 + openai==2.8.1
 +[2025-12-03 16:24:03.369606]  opencv-python-headless==4.11.0.86
 + packaging==25.0
 + pandas==2.3.3
 + pillow==12.0.0
 + pinecone-client==6.0.0
 + pinecone-plugin-interface==0.0.7
 + propcache==[2025-12-03 16:24:03.369706] 0.4.1
 + proto-plus==1.26.1
 + protobuf==5.29.5
 + pyarrow==21.0.0
 + pyasn1==0.6.1
 +[2025-12-03 16:24:03.369868]  pyasn1-modules==0.4.2
 + pyaudio==0.2.14
 + pydantic==2.12.5
 + pydantic-core==2.41.5
 + pydeck==0.9.1[2025-12-03 16:24:03.369965] 
 + pyjwt==2.10.1
 + pymongo==4.15.5
 + pyparsing==3.2.5
 + python-dateutil==2.9.0.post0
 + [2025-12-03 16:24:03.370060] pytz==2025.2
 + referencing==0.37.0
 + requests==2.32.5
 + requests-file==3.0.1
 + rpds-py==0.30.0
 + [2025-12-03 16:24:03.370137] rsa==4.9.1
 + scikit-learn==1.7.2
 + scipy==1.16.3
 + shodan==1.31.0
 + six==1.17.0
 + smmap==5.0.2
 + [2025-12-03 16:24:03.370213] sniffio==1.3.1
 + streamlit==1.51.0
 + streamlit-folium==0.25.3
 + tenacity==9.1.2
 + threadpoolctl==[2025-12-03 16:24:03.370306] 3.6.0
 + tldextract==5.3.0
 + toml==0.10.2
 + tornado==6.5.2
 + tqdm==4.67.1
 + [2025-12-03 16:24:03.370380] twilio==9.8.8
 + typing-extensions==4.15.0
 + typing-inspection==0.4.2
 + tzdata==2025.2
 + uritemplate==4.2.0
 + urllib3==2.5.0
 + vt-py==[2025-12-03 16:24:03.370463] 0.22.0
 + watchdog==6.0.0
 + xlsxwriter==3.2.9
 + xyzservices==2025.11.0
 + yarl==1.22.0
Checking if Streamlit is installed
Found Streamlit version 1.51.0 in the environment
Installing rich for an improved exception logging
Using uv pip install.
Using Python 3.13.9 environment at /home/adminuser/venv
Resolved 4 packages in 135ms
Prepared 4 packages in 100ms
Installed 4 packages in 19ms
 + markdown-it-py==4.0.0
 + mdurl==0.1.2
 + [2025-12-03 16:24:04.921188] pygments==2.19.2
 + rich==14.2.0

────────────────────────────────────────────────────────────────────────────────────────

[16:24:05] 🐍 Python dependencies were installed from /mount/src/arc-mainframe/requirements.txt using uv.
Check if streamlit is installed
Streamlit is already installed
[16:24:06] 📦 Processed dependencies!



────────────────────── Traceback (most recent call last) ───────────────────────
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/se  
  ssion_state.py:471 in __getitem__                                             
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/se  
  ssion_state.py:524 in _getitem                                                
────────────────────────────────────────────────────────────────────────────────
KeyError

During handling of the above exception, another exception occurred:

────────────────────── Traceback (most recent call last) ───────────────────────
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/scriptru  
  nner/exec_code.py:129 in exec_func_with_error_handling                        
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/scriptru  
  nner/script_runner.py:618 in code_to_exec                                     
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/sa  
  fe_session_state.py:68 in on_script_will_rerun                                
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/se  
  ssion_state.py:583 in on_script_will_rerun                                    
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/se  
  ssion_state.py:601 in _call_callbacks                                         
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/se  
  ssion_state.py:282 in call_callback                                           
                                                                                
  /mount/src/arc-mainframe/app.py:56 in password_entered                        
                                                                                
     53 │                                                                       
     54 │   def password_entered():                                             
     55 │   │   """Checks whether a password entered by the user is correct.""  
  ❱  56 │   │   if st.session_state["password"] == st.secrets["keys"]["ARC_PAS  
     57 │   │   │   st.session_state["password_correct"] = True                 
     58 │   │   │   del st.session_state["password"]  # Don't store password    
     59 │   │   else:                                                           
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/se  
  ssion_state_proxy.py:101 in __getitem__                                       
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/sa  
  fe_session_state.py:104 in __getitem__                                        
                                                                                
  /home/adminuser/venv/lib/python3.13/site-packages/streamlit/runtime/state/se  
  ssion_state.py:478 in __getitem__                                             
────────────────────────────────────────────────────────────────────────────────
KeyError: 'st.session_state has no key "password". Did you forget to initialize 
it? More info: 
https://docs.streamlit.io/develop/concepts/architecture/session-state#initializa
tion'
