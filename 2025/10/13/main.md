# Cisco 891 ルーターにおける ACL 検証

## 目次

<!-- @import "[TOC]" {cmd="toc" depthFrom=2 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [目次](#目次)
- [はじめに](#はじめに)
- [検証構成](#検証構成)
  - [物理トポロジ](#物理トポロジ)
  - [論理トポロジ](#論理トポロジ)
  - [基本コンフィグ](#基本コンフィグ)
  - [疎通確認](#疎通確認)
- [検証](#検証)
  - [GE7 out 方向で telnet を止めてみる (失敗)](#ge7-out-方向で-telnet-を止めてみる-失敗)
    - [設定](#設定)
    - [結果](#結果)
  - [GE8 in 方向で telnet を止めてみる (成功)](#ge8-in-方向で-telnet-を止めてみる-成功)
    - [設定](#設定-1)
    - [結果](#結果-1)
  - [vlan 1 IF out 方向で telnet を止めてみる (失敗)](#vlan-1-if-out-方向で-telnet-を止めてみる-失敗)
    - [設定](#設定-2)
    - [結果](#結果-2)
  - [中間まとめ](#中間まとめ)
- [更新履歴](#更新履歴)

<!-- /code_chunk_output -->

## はじめに

C891 でいろいろ ACL を設定して遊んでいたのですが，一部想定通りに動作しない事象を経験しました．
原因がよくわからず気持ち悪いので，とりあえず順を追って切り分けをしていこうと思った次第です．

## 検証構成

### 物理トポロジ

手抜きで C891 1台でやっていきます．GE8 (routed port) と GE7 (switched port) を結線しています．VRF は分けています．
![C891 物理結線](c891.png "GE8 と GE7 をつないでいます")

### 論理トポロジ

GE8 と VLAN Interface 1 が同セグで通信できるように IP アドレスを振っています．GE7 は vlan 1 のアクセスポートです．

```
GE8 ------------- GE7 ---- vlan 1 IF 
10.0.0.1/24              10.0.0.2/24
```

### 基本コンフィグ

IOS Version は 15.4(3)M3 です．

```
ip arp proxy disable
vtp mode transparent
no ip domain lookup

ip vrf vrf1
 rd 65001:1

enable algorithm-type scrypt secret cisco

interface GigabitEthernet 8
 ip address 10.0.0.1 255.255.255.0
 no shutdown

interface Vlan1
 ip vrf forwarding vrf1
 ip address 10.0.0.2 255.255.255.0
 no shutdown

interface GigabitEthernet 7
 switchport mode access
 switchport access vlan 1

line con 0
 logging synchronous
line vty 0 4
 password cisco
 login
 transport input telnet
```

### 疎通確認

```
Router#ping 10.0.0.2
Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 10.0.0.2, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/4 ms
Router#telnet 10.0.0.2
Trying 10.0.0.2 ... Open

User Access Verification

Password:
```

## 検証

いろいろな ACL を設定してみて，ping と telnet が疎通するか確認していきます．

### GE7 out 方向で telnet を止めてみる (失敗)

#### 設定

下記のように ACL を設定し，10.0.0.1 → 10.0.0.2 telnet の戻り通信を落としてみます．

```
access-list 100 deny   tcp host 10.0.0.2 eq telnet any log-input
access-list 100 permit ip any any log-input

interface GigabitEthernet7
 ip access-group 100 out
```

#### 結果

```
Router#ping 10.0.0.2
Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 10.0.0.2, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/1 ms

Router#telnet 10.0.0.2
Trying 10.0.0.2 ... Open

User Access Verification

Password:
```

…なぜ telnet が通ってしまうのでしょうか．

```
Router#show access-lists
Extended IP access list 100
    10 deny tcp host 10.0.0.2 eq telnet any log-input
    20 permit ip any any log-input
```

ACL のカウンタは上がっていませんし，ログも出ません．効いていないように見えます．

### GE8 in 方向で telnet を止めてみる (成功)

そもそも ACL の設定方法があっているか不安なので一番安定な routed port 試してみます．

#### 設定

```
interface GigabitEthernet 7
 no ip access-group out

interface GigabitEthernet 8
 ip access-group 100 in
```

#### 結果

```
Router#ping 10.0.0.2
Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 10.0.0.2, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms

*Oct 13 04:22:01.582: %SEC-6-IPACCESSLOGDP: list 100 permitted icmp 10.0.0.2 (GigabitEthernet8 xxxx.xxxx.xxxx) -> 10.0.0.1 (0/0), 1 packet

Router#telnet 10.0.0.2
Trying 10.0.0.2 ...
*Oct 13 04:22:42.250: %SEC-6-IPACCESSLOGP: list 100 denied tcp 10.0.0.2(23) (GigabitEthernet8 xxxx.xxxx.xxxx) -> 10.0.0.1(48223), 1 packet

Router#show access-lists
Extended IP access list 100
    10 deny tcp host 10.0.0.2 eq telnet any log-input (4 matches)
    20 permit ip any any log-input (5 matches)
```

想定通りの動作になりました．ACLログも見えています．

### vlan 1 IF out 方向で telnet を止めてみる (失敗)

#### 設定

```
interface GigabitEthernet 8
 no ip access-group in

clear access-list counters

interface vlan 1
 ip access-group 100 out
```

#### 結果

```
Router#ping 10.0.0.2
Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 10.0.0.2, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/4 ms

Router#telnet 10.0.0.2
Trying 10.0.0.2 ... Open

User Access Verification

Password:

Router#show access-lists
Extended IP access list 100
    10 deny tcp host 10.0.0.2 eq telnet any log-input
    20 permit ip any any log-input
```

vlan interface でも効いていませんね

### 中間まとめ
|I/F|I/F 種別|方向|SV→CL方向の遮断|
|:---:|:---:|:---:|:---:|
|GE8|L3|in|〇|
|GE7|L2|out|×|
|vlan 1|SVI|out|×|

SV→CL 通信制御の結果はこうなりました．次は CL→SV 通信の方で検証してみましょう．

## 更新履歴

- 2025-10-13: telnet サーバからの戻り通信を止める ACL の設定と結果確認