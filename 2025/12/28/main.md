# Cisco Modeling Labs 2.9.1 での Cisco SD-WAN 簡易検証

下書き。

## 基本構築

### 全体構成

### external connector

物理L2スイッチと管理用スイッチを trunk 接続するために作成します．

### 管理用スイッチ

Manager, Validator, Controller に管理アクセスするためのスイッチを作成します．

```
# IOL L2
hostname mgmt-sw
ip arp proxy disable
no ip domain lookup
vtp mode transparent

vlan 90
 name mgmt

interface Ethernet0/0
 switchport trunk encapsulation dot1q
 switchport trunk allowed vlan 90
 switchport mode trunk
 switchport nonegotiate

interface Ethernet0/1
 switchport access vlan 90
 switchport mode access
 switchport nonegotiate

interface Ethernet0/2
 switchport access vlan 90
 switchport mode access
 switchport nonegotiate

interface Ethernet0/3
 switchport access vlan 90
 switchport mode access
 switchport nonegotiate

interface Ethernet1/0
 switchport access vlan 90
 switchport mode access
 switchport nonegotiate
```

### Controller 用スイッチ

Edge ルーターが Manager, Validator, Controller にアクセスするためのネットワーク用スイッチを作ります．

```
# IOL L2
hostname mgmt-sw
ip arp proxy disable
no ip domain lookup
vtp mode transparent

vlan 10
 name sdwan-ctlr

interface Ethernet0/0
 switchport access vlan 10
 switchport mode access
 switchport nonegotiate

interface Ethernet0/1
 switchport access vlan 10
 switchport mode access
 switchport nonegotiate

interface Ethernet0/2
 switchport access vlan 10
 switchport mode access
 switchport nonegotiate

interface Ethernet0/3
 switchport access vlan 10
 switchport mode access
 switchport nonegotiate

interface Ethernet1/0
 switchport access vlan 10
 switchport mode access
 switchport nonegotiate
```


### Manager

#### コンソールから基本設定

- コンソールから admin / cisco でログイン
- 下記設定を入れて commit

```
system
 host-name             Manager-101
 system-ip             10.10.255.101
 site-id               10
 sp-organization-name  myorg
 organization-name     myorg
 vbond 172.16.10.102

 ntp
  server 172.16.10.1
   vpn 0
   version 4
  exit

vpn 0
 interface eth0
  ip address 172.16.10.101/24
  no ipv6 dhcp-client
  ipv6 shutdown
  tunnel-interface
   no allow-service dhcp
   no allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service stun
   no allow-service https
  no shutdown
 ip route 0.0.0.0/0 172.16.10.1

vpn 512
 interface eth1
  ip address 192.168.90.101/24
  no shutdown
```

#### GUI から基本設定

- ブラウザから `https://192.168.90.101` にアクセスして admin / cisco でログイン
- `Warning: organization name not found` と言われる (設定しているんだけどな)
- Administratin → Settings → System → Organization name で改めて `myorg` を設定
- Administratin → Settings → System → Validator も入っていなかった．改めて `172.16.10.102` を設定

#### ルート証明書の作成

- コンソール上で vshell に入り openssl コマンドで作成する
```
vshell
#--- 秘密鍵作成
openssl ecparam -genkey -name prime256v1 -out caroot_privkey.pem
#--- 証明書作成
openssl req -x509 -new -nodes -key caroot_privkey.pem -sha512 -days 3650 -subj "/CN=CAROOT" -out caroot.crt
```
- 出来上がった証明書内容を確認
```
cat caroot.crt
```

#### Manager へのルート証明書の登録

- Administratin → Settings → Controller Certificate Authorization
- Enterprise Root Certificate
- 作成した証明書の中身を貼り付け
- Set CSR Properties オン
- Domain Name: example.com
- Organization: myorg
- Organizational Unit: myorg
- City: Tokyo
- State: Tokyo
- Email: example@example.com
- 2-letter Country Code: JP

#### Manager の証明書の作成

- Configuration → Certificates → Control Components → Manager-101
- Actions → Generate CSR
- vshell 上で `ls -l` すると `vmanage_csr` として保存されている
- 証明書の作成
```
openssl x509 -req -in vmanage_csr -CA caroot.crt -CAkey caroot_privkey.pem -CAcreateserial -out Manager-101.crt -days 3650 -sha512
```
- Manager-101.crt の内容をコピー
- Install Certificate → 貼り付けて Install
- Status: Success

### Validator

#### コンソールから基本設定

- admin / cisco でログイン

```
system
 host-name               Validator-102
 system-ip               10.10.255.102
 site-id                 10
 sp-organization-name    myorg
 organization-name       myorg
 vbond 172.16.10.102 local

 ntp
  server 172.16.10.1
   vpn 0
   version 4
  exit

vpn 0
 no interface eth0
 interface ge0/0
  ip address 172.16.10.102/24
  no ipv6 dhcp-client
  ipv6 shutdown
  no shutdown
 ip route 0.0.0.0/0 172.16.10.1

vpn 512
 interface eth0
  ip address 192.168.90.102/24
  no shutdown
```

- Manager から `ping 10.0.10.102` が疎通することを確認
- SSH で `192.168.90.102` にアクセスできることを確認

#### Manager GUI から基本設定

- Configuration → Devices → Control Components → Add Validator
- Validator Management IP Address: 172.16.10.102
- Username: admin
- Password: cisco
- Generate CSR: Yes
- CSR を vshell 上で保存
- 証明書作成
```
openssl x509 -req -in Validator-102.csr -CA caroot.crt -CAkey caroot_privkey.pem -CAcreateserial -out Validator-102.crt -days 3650 -sha512
```
- 証明書インストール
- Status: Success

#### Tunnel Interface の設定

```
vpn 0
 interface ge0/0
  tunnel-interface
   encapsulation ipsec
   no allow-service bgp
   no allow-service dhcp
   no allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service ospf
   no allow-service stun
   no allow-service https
```

#### show orchestrator connections の確認

```
Validator-102# show orchestrator connections
                                                                                     PEER                      PEER
         PEER     PEER     PEER             SITE        DOMAIN      PEER             PRIVATE  PEER             PUBLIC                                   ORGANIZATION
INSTANCE TYPE     PROTOCOL SYSTEM IP        ID          ID          PRIVATE IP       PORT     PUBLIC IP        PORT    REMOTE COLOR     STATE           NAME                    UPTIME
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
0        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    12346    172.16.10.101    12346   default          up              myorg                   0:00:00:47
0        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    12446    172.16.10.101    12446   default          up              myorg                   0:00:00:48
0        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    12746    172.16.10.101    12746   default          up              myorg                   0:00:00:48
1        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    12546    172.16.10.101    12546   default          up              myorg                   0:00:00:47
1        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    12646    172.16.10.101    12646   default          up              myorg                   0:00:00:48
1        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    12846    172.16.10.101    12846   default          up              myorg                   0:00:00:48
1        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    12946    172.16.10.101    12946   default          up              myorg                   0:00:00:47
1        vmanage  dtls     10.10.255.101    10          0           172.16.10.101    13046    172.16.10.101    13046   default          up              myorg                   0:00:00:48
```

### Controller 1

- admin / cisco でログイン

#### コンソールから基本設定

```
system
 host-name             Controller-103
 system-ip             10.10.255.103
 site-id               10
 sp-organization-name  myorg
 organization-name     myorg
 vbond 172.16.10.102

 ntp
  server 172.16.10.1
   vpn 0
   version 4
  exit

vpn 0
 interface eth0
  ip address 172.16.10.103/24
  no ipv6 dhcp-client
  ipv6 shutdown
  no shutdown
 !
 ip route 0.0.0.0/0 172.16.10.1
!
vpn 512
 interface eth1
  ip address 192.168.90.103/24
  no shutdown
```

- Manager から `ping 172.16.10.103` が疎通することを確認
- SSH で `192.168.90.103` にアクセスできることを確認

#### Manager GUI から基本設定

- Configuration → Devices → Control Components → Add Controller
- Controller Management IP Address: 172.16.10.103
- Username: admin
- Password: cisco
- Ptoyovol: DTLS
- Generate CSR: Yes
- CSR を vshell 上で保存
- 証明書作成
```
openssl x509 -req -in Controller-103.csr -CA caroot.crt -CAkey caroot_privkey.pem -CAcreateserial -out Controller-103.crt -days 3650 -sha512
```
- 証明書インストール
- Status: Success

#### Tunnel Interface 有効化

```
vpn 0
 interface eth0
  tunnel-interface
   no allow-service dhcp
   no allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service stun
```

#### show control connections

```
Controller-103# show control connections
                                                                                             PEER                                          PEER
      PEER    PEER PEER            SITE       DOMAIN PEER                                    PRIV  PEER                                    PUB
INDEX TYPE    PROT SYSTEM IP       ID         ID     PRIVATE IP                              PORT  PUBLIC IP                               PORT  ORGANIZATION            REMOTE COLOR     STATE UPTIME
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
0     vbond   dtls 10.10.255.102   0          0      172.16.10.102                           12346 172.16.10.102                           12346 myorg                     default         up     0:00:00:11
0     vmanage dtls 10.10.255.101   10         0      172.16.10.101                           12346 172.16.10.101                           12346 myorg                     default         up     0:00:00:03
1     vbond   dtls 10.10.255.102   0          0      172.16.10.102                           12346 172.16.10.102                           12346 myorg                     default         up     0:00:00:11
```

### Controller 2

- admin / cisco でログイン

#### コンソールから基本設定

```
system
 host-name             Controller-104
 system-ip             10.10.255.104
 site-id               10
 sp-organization-name  myorg
 organization-name     myorg
 vbond 172.16.10.102

 ntp
  server 172.16.10.1
   vpn 0
   version 4
  exit

vpn 0
 interface eth0
  ip address 172.16.10.104/24
  no ipv6 dhcp-client
  ipv6 shutdown
  no shutdown
 !
 ip route 0.0.0.0/0 172.16.10.1
!
vpn 512
 interface eth1
  ip address 192.168.90.104/24
  no shutdown
```

- Manager から `ping 172.16.10.104` が疎通することを確認
- SSH で `192.168.90.104` にアクセスできることを確認

#### Manager GUI から基本設定

- Configuration → Devices → Control Components → Add Controller
- Controller Management IP Address: 172.16.10.104
- Username: admin
- Password: cisco
- Ptoyovol: DTLS
- Generate CSR: Yes
- CSR を vshell 上で保存
- 証明書作成
```
openssl x509 -req -in Controller-104.csr -CA caroot.crt -CAkey caroot_privkey.pem -CAcreateserial -out Controller-104.crt -days 3650 -sha512
```
- 証明書インストール
- Status: Success

#### Tunnel Interface 有効化

```
vpn 0
 interface eth0
  tunnel-interface
   no allow-service dhcp
   no allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service stun
```

#### show control connections

```
Controller-104# show control connections
                                                                                             PEER                                          PEER
      PEER    PEER PEER            SITE       DOMAIN PEER                                    PRIV  PEER                                    PUB
INDEX TYPE    PROT SYSTEM IP       ID         ID     PRIVATE IP                              PORT  PUBLIC IP                               PORT  ORGANIZATION            REMOTE COLOR     STATE UPTIME
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
0     vsmart  dtls 10.10.255.103   10         1      172.16.10.103                           12346 172.16.10.103                           12346 myorg                     default         up     0:00:00:03
0     vbond   dtls 10.10.255.102   0          0      172.16.10.102                           12346 172.16.10.102                           12346 myorg                     default         up     0:00:00:13
0     vmanage dtls 10.10.255.101   10         0      172.16.10.101                           12346 172.16.10.101                           12346 myorg                     default         up     0:00:00:10
1     vbond   dtls 10.10.255.102   0          0      172.16.10.102                           12346 172.16.10.102                           12346 myorg                     default         up     0:00:00:13
```

### ゲートウェイルーター

各NW間をルーティングするためのルーターを作成します．インターネットに相当します．

```
# IOL
hostname gateway-rt
ip arp proxy disable
no ip domain lookup

interface Loopback0
 ip address 172.16.0.1 255.255.255.255

interface Ethernet0/1
 description wan10
 ip address 172.16.10.1 255.255.255.0
 no shutdown

interface Ethernet0/2
 description wan21
 ip address 172.16.21.1 255.255.255.0
 no shutdown

interface Ethernet0/3
 description wan22
 ip address 172.16.22.1 255.255.255.0
 no shutdown
```

### wan21 スイッチ

```
# IOL-L2
hostname wan21-sw
ip arp proxy disable
no ip domain lookup
vtp mode transparent

vlan 21

interface Ethernet0/0
 switchport access vlan 21
 switchport mode access
 switchport nonegotiate

interface Ethernet0/1
 switchport access vlan 21
 switchport mode access
 switchport nonegotiate

interface Ethernet0/2
 switchport access vlan 21
 switchport mode access
 switchport nonegotiate

interface Ethernet0/3
 switchport access vlan 21
 switchport mode access
 switchport nonegotiate
```

### wan22 スイッチ

```
# IOL-L2
hostname wan22-sw
ip arp proxy disable
no ip domain lookup
vtp mode transparent

vlan 22

interface Ethernet0/0
 switchport access vlan 22
 switchport mode access
 switchport nonegotiate

interface Ethernet0/1
 switchport access vlan 22
 switchport mode access
 switchport nonegotiate

interface Ethernet0/2
 switchport access vlan 22
 switchport mode access
 switchport nonegotiate

interface Ethernet0/3
 switchport access vlan 22
 switchport mode access
 switchport nonegotiate
```

### Edge

エッジルーターを追加していきます．

#### PAYG WAN Edges の追加

- Configuration → Devices → WAN Edges
- Add PAYG WAN Edges
- Enter the number of PAYG WAN Edges: 2
- Send to Controllers: Yes

WAN Edge List に2つ追加され，Chassis Number が採番されます．

### Edge-121

#### 起動前に cloud-config の設定

- CML 上で Catalyst SD-WAN Edge ノードを追加
- Manager 上で WAN Edge List の1台目の Action から Generate Bootstrap Configuration
- 内容を全選択し，CML 上で Edge の CONFIG の該当箇所に貼り付け
- 下記のようになります
```
Content-Type: multipart/mixed; boundary="==BOUNDARY=="
MIME-Version: 1.0

--==BOUNDARY==
Content-Type: text/cloud-config; charset="us-ascii"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit
Content-Disposition: attachment; filename="cloud-config"

#cloud-config
vinitparam:
 - uuid : C8K-PAYG-*****
 - otp : *****
 - vbond : 172.16.10.102
 - org : myorg
 - rcc : true
ca-certs:
  remove-defaults: false
  trusted:
  - |
   -----BEGIN CERTIFICATE-----
   …
   -----END CERTIFICATE-----
--==BOUNDARY==
Content-Type: text/cloud-boothook; charset="us-ascii"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit
Content-Disposition: attachment;
filename="config-C8K.txt"

#cloud-boothook
  hostname inserthostname-here
  username cisco privilege 15 secret 0 cisco
  platform console serial
  !
!
--==BOUNDARY==--
```
- Edge ノード起動

#### コンソールから基本設定

cisco / cisco でログイン

```
config-transaction

hostname Edge-121
system
 system-ip             10.120.255.121
 site-id               120
 admin-tech-on-failure
 sp-organization-name  myorg
 organization-name     myorg
 vbond 172.16.10.102
exit

interface GigabitEthernet 1
 ip address 172.16.21.121 255.255.255.0
 no shutdown
exit
interface GigabitEthernet 2
 ip address 172.16.22.121 255.255.255.0
 no shutdown
exit

ip route 0.0.0.0 0.0.0.0 172.16.21.1
ip route 0.0.0.0 0.0.0.0 172.16.22.1

interface Tunnel1
 ip unnumbered GigabitEthernet1
 tunnel source GigabitEthernet1
 tunnel mode sdwan
exit
interface Tunnel2
 ip unnumbered GigabitEthernet2
 tunnel source GigabitEthernet2
 tunnel mode sdwan
exit

sdwan
 interface GigabitEthernet1
  tunnel-interface
   encapsulation ipsec
   color biz-internet
   no allow-service bgp
   allow-service dhcp
   allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service ospf
   no allow-service stun
   allow-service https
   no allow-service snmp
   no allow-service bfd
  exit
 exit
 interface GigabitEthernet2
  tunnel-interface
   encapsulation ipsec
   color public-internet
   no allow-service bgp
   allow-service dhcp
   allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service ospf
   no allow-service stun
   allow-service https
   no allow-service snmp
   no allow-service bfd
  exit
 exit

commit
```

#### ログ確認

上記設定を入れると自動で諸々処理が進み，Manager 側から見えるようになる．

```
*Dec 29 07:55:05.559: %LINEPROTO-5-UPDOWN: Line protocol on Interface SDWAN System Intf IDB, changed state to up
*Dec 29 07:55:05.753: %SYS-5-CONFIG_P: Configured programmatically by process iosp_dmiauthd_conn_100001_vty_100001 from console as cisco on vty4294966926
*Dec 29 07:55:05.324: %DMI-5-CONFIG_I: R0/0: dmiauthd: Configured from NETCONF/RESTCONF by cisco, transaction-id 589
*Dec 29 07:55:05.451: %OMPD-5-STATE_UP: R0/0: ompd: Operational state changed to UP
*Dec 29 07:55:05.482: %VDAEMON-6-VMANAGE_CONNECTION_PREF_CHANGED: R0/0: vdaemon: vManage connection preference for interface: GigabitEthernet1 (color: default) changed to 5
*Dec 29 07:55:05.482: %VDAEMON-6-TLOC_IP_CHANGE: R0/0: vdaemon: Control connection TLOC changed from 172.16.21.121:12346 to 172.16.21.121:12366
*Dec 29 07:55:05.548: %VDAEMON-6-SYSTEM_IP_CHANGED: R0/0: vdaemon: System IP changed from 0.0.0.0 to 10.120.255.121 via config
*Dec 29 07:55:05.548: %VDAEMON-6-SITE_ID_CHANGED: R0/0: vdaemon: Site id changed from 0 to 120 via config
*Dec 29 07:55:05.548: %VDAEMON-6-ORG_NAME_CHANGED: R0/0: vdaemon: Organization name changed from  to myorg
*Dec 29 07:55:05.815: %LINEPROTO-5-UPDOWN: Line protocol on Interface Tunnel1, changed state to up
*Dec 29 07:55:06.117: %LINEPROTO-5-UPDOWN: Line protocol on Interface Tunnel2, changed state to up
*Dec 29 07:57:39.773: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/biz-internet via biz-internet) is UP
*Dec 29 07:57:40.558: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:35856  for netconf over ssh. External groups:
*Dec 29 07:57:42.792: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/public-internet via public-internet) is UP
*Dec 29 07:57:43.795: %IOSXE-5-PLATFORM: R0/0: vip-bootstrap: CDB snapshotted in /var/confd0/cdb-backup.cfg, took 3 seconds
*Dec 29 07:57:45.652: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:41906  for netconf over ssh. External groups:
*Dec 29 07:57:51.559: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:41976  for netconf over ssh. External groups:
*Dec 29 07:57:58.265: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:37230  for netconf over ssh. External groups:
*Dec 29 07:57:58.433: %CERT-5-NEW_CSR_GENERATED: R0/0: vip-confd-startup.sh: New certificate signing request generated
*Dec 29 07:58:06.034: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:52304  for netconf over ssh. External groups:
*Dec 29 07:58:10.085: %VDAEMON-6-SYSTEM_LICENSE_MISMATCH: R0/0: vdaemon: There is a license association mismatch. BYOL instance is being associated to PAYG license
*Dec 29 07:58:13.191: %CERT-5-ROOT_CERT_CHAIN_INSTALLED: R0/0: vip-confd-startup.sh: Root certificate chain installed
*Dec 29 07:58:34.378: %CERT-5-ROOT_CERT_CHAIN_INSTALLED: R0/0: vip-confd-startup.sh: Root certificate chain installed
*Dec 29 07:58:34.690: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:38704  for netconf over ssh. External groups:
*Dec 29 07:58:40.167: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:38712  for netconf over ssh. External groups:
*Dec 29 07:58:52.717: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:48028  for netconf over ssh. External groups:
*Dec 29 07:58:53.673: %CERT-5-CERT_INSTALLED: R0/0: vip-confd-startup.sh: A new certificate has been installed
*Dec 29 07:58:56.587: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/biz-internet via biz-internet) is DOWN
*Dec 29 07:58:57.364: %OMPD-3-PEER_STATE_INIT: R0/0: ompd: vSmart peer 10.10.255.104 state changed to Init
*Dec 29 07:58:57.401: %OMPD-3-PEER_STATE_INIT: R0/0: ompd: vSmart peer 10.10.255.103 state changed to Init
*Dec 29 07:58:58.232: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:48040  for netconf over ssh. External groups:
*Dec 29 07:58:59.472: %OMPD-6-PEER_STATE_HANDSHAKE: R0/0: ompd: vSmart peer 10.10.255.104 state changed to Handshake
*Dec 29 07:58:59.472: %OMPD-6-PEER_STATE_HANDSHAKE: R0/0: ompd: vSmart peer 10.10.255.103 state changed to Handshake
*Dec 29 07:58:59.476: %OMPD-5-PEER_STATE_UP: R0/0: ompd: vSmart peer 10.10.255.104 state changed to Up
*Dec 29 07:58:59.477: %OMPD-6-NUMBER_OF_VSMARTS: R0/0: ompd: Number of vSmarts connected : 1
*Dec 29 07:58:59.477: %OMPD-5-PEER_STATE_UP: R0/0: ompd: vSmart peer 10.10.255.103 state changed to Up
*Dec 29 07:58:59.477: %OMPD-6-NUMBER_OF_VSMARTS: R0/0: ompd: Number of vSmarts connected : 2
*Dec 29 07:59:03.292: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:47591  for netconf over ssh. External groups:
*Dec 29 07:59:09.031: %IOSXE-5-PLATFORM: R0/0: vip-bootstrap: CDB snapshotted in /var/confd0/cdb-backup.cfg, took 12 seconds
*Dec 29 07:59:14.070: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/biz-internet via biz-internet) is DOWN
*Dec 29 07:59:26.740: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:50330  for netconf over ssh. Externmgcp profile default
```

### Edge-131

#### 起動前に cloud-config の設定

Edge-121 と同様に進める．

#### コンソールから基本設定

cisco / cisco でログイン

```
config-transaction

hostname Edge-131
system
 system-ip             10.130.255.131
 site-id               130
 admin-tech-on-failure
 sp-organization-name  myorg
 organization-name     myorg
 vbond 172.16.10.102
exit

interface GigabitEthernet 1
 ip address 172.16.21.131 255.255.255.0
 no shutdown
exit
interface GigabitEthernet 2
 ip address 172.16.22.131 255.255.255.0
 no shutdown
exit

ip route 0.0.0.0 0.0.0.0 172.16.21.1
ip route 0.0.0.0 0.0.0.0 172.16.22.1

interface Tunnel1
 ip unnumbered GigabitEthernet1
 tunnel source GigabitEthernet1
 tunnel mode sdwan
exit
interface Tunnel2
 ip unnumbered GigabitEthernet2
 tunnel source GigabitEthernet2
 tunnel mode sdwan
exit

sdwan
 interface GigabitEthernet1
  tunnel-interface
   encapsulation ipsec
   color biz-internet
   no allow-service bgp
   allow-service dhcp
   allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service ospf
   no allow-service stun
   allow-service https
   no allow-service snmp
   no allow-service bfd
  exit
 exit
 interface GigabitEthernet2
  tunnel-interface
   encapsulation ipsec
   color public-internet
   no allow-service bgp
   allow-service dhcp
   allow-service dns
   allow-service icmp
   no allow-service sshd
   no allow-service netconf
   no allow-service ntp
   no allow-service ospf
   no allow-service stun
   allow-service https
   no allow-service snmp
   no allow-service bfd
  exit
 exit

commit
```

#### ログ確認

上記設定を入れると自動で諸々処理が進み，Manager 側から見えるようになる．

```
*Dec 29 08:05:06.656: %LINEPROTO-5-UPDOWN: Line protocol on Interface Tunnel1, changed state to down
*Dec 29 08:05:06.702: %LINEPROTO-5-UPDOWN: Line protocol on Interface Tunnel1, changed state to up
*Dec 29 08:05:07.169: %DMI-5-CONFIG_I: R0/0: dmiauthd: Configured from NETCONF/RESTCONF by binos, transaction-id 585
*Dec 29 08:05:07.476: %OMPD-5-STATE_UP: R0/0: ompd: Operational state changed to UP
*Dec 29 08:05:07.733: %LINEPROTO-5-UPDOWN: Line protocol on Interface SDWAN System Intf IDB, changed state to up
*Dec 29 08:05:07.545: %VDAEMON-6-VMANAGE_CONNECTION_PREF_CHANGED: R0/0: vdaemon: vManage connection preference for interface: GigabitEthernet1 (color: default) changed to 5
*Dec 29 08:05:07.546: %VDAEMON-6-TLOC_IP_CHANGE: R0/0: vdaemon: Control connection TLOC changed from 172.16.21.131:12346 to 172.16.21.131:12366
*Dec 29 08:05:07.690: %VDAEMON-6-SYSTEM_IP_CHANGED: R0/0: vdaemon: System IP changed from 0.0.0.0 to 10.130.255.131 via config
*Dec 29 08:05:07.690: %VDAEMON-6-SITE_ID_CHANGED: R0/0: vdaemon: Site id changed from 0 to 130 via config
*Dec 29 08:05:07.690: %VDAEMON-6-ORG_NAME_CHANGED: R0/0: vdaemon: Organization name changed from  to myorg
*Dec 29 08:05:07.972: %LINEPROTO-5-UPDOWN: Line protocol on Interface Tunnel2, changed state to up
*Dec 29 08:05:07.980: %SYS-5-CONFIG_P: Configured programmatically by process iosp_dmiauthd_conn_100001_vty_100001 from console as binos on vty4294966926
*Dec 29 08:05:08.164: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/public-internet via public-internet) is UP
*Dec 29 08:05:11.094: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/biz-internet via biz-internet) is UP
*Dec 29 08:05:12.243: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:50920  for netconf over ssh. External groups:
*Dec 29 08:05:16.317: %IOSXE-5-PLATFORM: R0/0: vip-bootstrap: CDB snapshotted in /var/confd0/cdb-backup.cfg, took 5 seconds
*Dec 29 08:05:17.522: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:39624  for netconf over ssh. External groups:
*Dec 29 08:05:22.720: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:44134  for netconf over ssh. External groups:
*Dec 29 08:05:30.340: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:44154  for netconf over ssh. External groups:
*Dec 29 08:05:33.317: %CERT-5-NEW_CSR_GENERATED: R0/0: vip-confd-startup.sh: New certificate signing request generated
*Dec 29 08:05:40.082: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:49454  for netconf over ssh. External groups:
*Dec 29 08:05:41.547: %VDAEMON-6-SYSTEM_LICENSE_MISMATCH: R0/0: vdaemon: There is a license association mismatch. BYOL instance is being associated to PAYG license
*Dec 29 08:05:55.981: %CERT-5-ROOT_CERT_CHAIN_INSTALLED: R0/0: vip-confd-startup.sh: Root certificate chain installed
*Dec 29 08:05:56.329: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:48516  for netconf over ssh. External groups:
*Dec 29 08:06:02.086: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:48528  for netconf over ssh. External groups:
*Dec 29 08:06:11.748: %CERT-5-ROOT_CERT_CHAIN_INSTALLED: R0/0: vip-confd-startup.sh: Root certificate chain installed
*Dec 29 08:06:30.869: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:47848  for netconf over ssh. External groups:
*Dec 29 08:06:35.001: %CERT-5-CERT_INSTALLED: R0/0: vip-confd-startup.sh: A new certificate has been installed
*Dec 29 08:06:36.109: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:55552  for netconf over ssh. External groups:
*Dec 29 08:06:37.476: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/biz-internet via biz-internet) is DOWN
*Dec 29 08:06:38.159: %OMPD-3-PEER_STATE_INIT: R0/0: ompd: vSmart peer 10.10.255.104 state changed to Init
*Dec 29 08:06:38.159: %OMPD-3-PEER_STATE_INIT: R0/0: ompd: vSmart peer 10.10.255.103 state changed to Init
*Dec 29 08:06:40.780: %OMPD-6-PEER_STATE_HANDSHAKE: R0/0: ompd: vSmart peer 10.10.255.104 state changed to Handshake
*Dec 29 08:06:40.780: %OMPD-6-PEER_STATE_HANDSHAKE: R0/0: ompd: vSmart peer 10.10.255.103 state changed to Handshake
*Dec 29 08:06:40.786: %OMPD-5-PEER_STATE_UP: R0/0: ompd: vSmart peer 10.10.255.104 state changed to Up
*Dec 29 08:06:40.786: %OMPD-6-NUMBER_OF_VSMARTS: R0/0: ompd: Number of vSmarts connected : 1
*Dec 29 08:06:40.786: %OMPD-5-PEER_STATE_UP: R0/0: ompd: vSmart peer 10.10.255.103 state changed to Up
*Dec 29 08:06:40.786: %OMPD-6-NUMBER_OF_VSMARTS: R0/0: ompd: Number of vSmarts connected : 2
*Dec 29 08:06:42.106: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:55564  for netconf over ssh. External groups:
*Dec 29 08:06:50.212: %IOSXE-5-PLATFORM: R0/0: vip-bootstrap: CDB snapshotted in /var/confd0/cdb-backup.cfg, took 12 seconds
*Dec 29 08:06:53.832: %VDAEMON-5-CONTROL_CONN_STATE_CHANGE: R0/0: vdaemon: Control connection to vBond :: (TLOC: 172.16.10.102/12346/biz-internet via biz-internet) is DOWN
*Dec 29 08:07:01.899: %DMI-5-AUTH_PASSED: R0/0: dmiauthd: User 'vmanage-admin' authenticated successfully from 10.10.255.101:33008  for netconf over ssh. External groups:
```

## 詳細設定

Manager から Configuration Group を設定し Edge に適用させていく．

### LAN to LAN 通信ができるようにする

#### 基本の Configuration Group

まず基本となる Configuration Group をワークフローを使ってざっくり作成．

- Configuration → Configuration Groups
- Create Configuration Group → Create from Guided Workflow
- Name: DefaultBranches
- Site Configurations
  * Site Type
    + Configuration Group Type: Single Router
  * Site Settings
    + Local Device Access: (Global) admin
    + Confirm Password: (Global) admin
  * WAN Interfaces
    + 1つ目
      - Static
      - Transport Name: biz-internet
      - Interface Color: biz-internet
      - Show Advanced
        * Interface Name: (Global) GigabitEthernet1
        * IP Address: (Device Specific)
        * Subnet: (Device Specific)
    + 2つ目
      - Static
      - Transport Name: public-internet
      - Interface Color: public-internet
      - Show Advanced
        * Interface Name: (Global) GigabitEthernet2
        * IP Address: (Device Specific)
        * Subnet: (Device Specific)
  * WAN Routing
    + Add Routing
      - Static IPv4: Next Hop
      - Next Hop
        * (Global) 172.16.21.1
        * (Global) 172.16.22.1
  * LAN & Service VPN Profile
    + 1つ目
      - Segment Name: (Global) SalesLAN
      - VPN: (Global) 10
      - Number of Interfaces: 1
      - Show Advanced
        * Interface Name: (Global) GigabitEthernet3
        * IP Address: (Device Specific)
        * Subnet: (Device Specific)

#### デバイスの関連付けと適用

- Associate Devices → SITE_120, SITE_130 の Edges を追加
- "Do you want to provision devices in DefaultBranches ?" と聞かれるので Provision Devices
- Device Specific に指定したパラメータを埋めていく
  * Edge-121
    * biz-internet wan IP: 172.16.21.121/24
    * public-internet wan IP: 172.16.22.121/24
    * VPN 10 IP: 10.120.10.1/24
  * Edge-131
    * biz-internet wan IP: 172.16.21.131/24
    * public-internet wan IP: 172.16.22.131/24
    * VPN 10 IP: 10.130.10.1/24
- Deploy
- View Deployment Status で正常完了を確認

#### LAN 側 DHCP サーバー有効化と端末追加

- Configuration Groups → Service Profile → DefaultBranchesLAN → Actions → Edit
- Ethenet Interface の右の + マークから DHCP Server を追加
- Add New で新規 DHCP Server 設定を追加
  * Name: VPN10_DHCPServer
  * Basic Configuration:
    + Network Address: (Device Specific)
    + Subnet Mask: (Device Specific)
  * Advanced
    + Default Gateway: (Device Specific)
- 変更を Deploy する
  * Edge-121
    + DHCP Address Pool Nework: 10.120.10.0/24
    + DHCP Default Gateway: 10.120.10.1
    + DHCP Exclude: 10.120.10.0-10.120.10.15,10.120.10.255
  * Edge-131
    + DHCP Address Pool Nework: 10.130.10.0/24
    + DHCP Default Gateway: 10.130.10.1
    + DHCP Exclude: 10.130.10.0-10.130.10.15,10.130.10.255
- LAN 側に Ubuntu ノードを接続してアドレスがもらえることを確認
- `show sdwan omp routes` で互いの LAN セグメントが見えていることを確認

```
Edge-121# show sdwan omp routes
                                                      PATH                      ATTRIBUTE                                                       GROUP
TENANT    VPN    PREFIX              FROM PEER        ID     LABEL    STATUS    TYPE       TLOC IP          COLOR            ENCAP  PREFERENCE  NUMBER      REGION ID   REGION PATH
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
0         10     10.120.10.0/24      0.0.0.0          68     1003     C,Red,R   installed  10.120.255.121   biz-internet     ipsec  -           None        None        -
                                     0.0.0.0          69     1003     C,Red,R   installed  10.120.255.121   public-internet  ipsec  -           None        None        -
0         10     10.130.10.0/24      10.10.255.103    1      1003     C,I,R     installed  10.130.255.131   biz-internet     ipsec  -           None        None        -
                                     10.10.255.103    2      1003     C,I,R     installed  10.130.255.131   public-internet  ipsec  -           None        None        -
                                     10.10.255.104    1      1003     C,R       installed  10.130.255.131   biz-internet     ipsec  -           None        None        -
                                     10.10.255.104    2      1003     C,R       installed  10.130.255.131   public-internet  ipsec  -           None        None        -
```
```
Edge-131# show sdwan omp routes
                                                      PATH                      ATTRIBUTE                                                       GROUP
TENANT    VPN    PREFIX              FROM PEER        ID     LABEL    STATUS    TYPE       TLOC IP          COLOR            ENCAP  PREFERENCE  NUMBER      REGION ID   REGION PATH
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
0         10     10.120.10.0/24      10.10.255.103    1      1003     C,I,R     installed  10.120.255.121   biz-internet     ipsec  -           None        None        -
                                     10.10.255.103    2      1003     C,I,R     installed  10.120.255.121   public-internet  ipsec  -           None        None        -
                                     10.10.255.104    1      1003     C,R       installed  10.120.255.121   biz-internet     ipsec  -           None        None        -
                                     10.10.255.104    2      1003     C,R       installed  10.120.255.121   public-internet  ipsec  -           None        None        -
0         10     10.130.10.0/24      0.0.0.0          68     1003     C,Red,R   installed  10.130.255.131   biz-internet     ipsec  -           None        None        -
                                     0.0.0.0          69     1003     C,Red,R   installed  10.130.255.131   public-internet  ipsec  -           None        None        -
```

- 互いに ping 疎通することを確認．これだけで Site-to-Site 通信は可能なんですね

```
cisco@ubuntu-120-01:~$ ping 10.130.10.16 -I 10.120.10.16
PING 10.130.10.16 (10.130.10.16) from 10.120.10.16 : 56(84) bytes of data.
64 bytes from 10.130.10.16: icmp_seq=1 ttl=62 time=4.62 ms
64 bytes from 10.130.10.16: icmp_seq=2 ttl=62 time=3.63 ms
64 bytes from 10.130.10.16: icmp_seq=3 ttl=62 time=3.28 ms
```
```
cisco@ubuntu-130-01:~$ ping 10.120.10.16 -I 10.130.10.16
PING 10.120.10.16 (10.120.10.16) from 10.130.10.16 : 56(84) bytes of data.
64 bytes from 10.120.10.16: icmp_seq=1 ttl=62 time=2.59 ms
64 bytes from 10.120.10.16: icmp_seq=2 ttl=62 time=2.91 ms
64 bytes from 10.120.10.16: icmp_seq=3 ttl=62 time=2.77 ms
```