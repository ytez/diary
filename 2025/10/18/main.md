# FortiGate 60F の初期セットアップ

よく忘れるのでメモ．

```c
//--- 初期化
# execute factoryreset
This operation will reset the system to factory default!
Do you want to continue? (y/n)y

//--- 初期パスワード変更
FortiGate-60F login: admin
Password: 
Verifying password...

You are forced to change your password. Please input a new password.
New Password: 
Confirm Password: 
Verifying password...
Welcome!

//--- vdom 有効化
# config system global
(global) # set vdom-mode multi-vdom 
(global) # end
You will be logged out for the operation to take effect.
Do you want to continue? (y/n)y

//--- デフォルトの DHCPv4 サーバー設定削除
# config vdom
(vdom) # edit root
(root) # config system dhcp server 
(server) # delete 1
(server) # delete 2
(server) # end

//--- デフォルトの firewall ポリシー削除
(root) # config firewall policy
(policy) # delete 1
(policy) # end

//--- アドレス internal を削除
(root) # config firewall address
(address) # delete internal 
(address) # end

//--- vswitch internal を削除
# config global
(global) # config system virtual-switch
(virtual-switch) # delete internal
```
