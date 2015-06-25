function TreeView($dom, store, adapter) {
  this.$view = $dom.find('.octotree_treeview')
  this.store = store
  this.adapter = adapter
  this.$view.find('#toggleOtherRepos').click(function(e) {
    e.preventDefault();
    $('.octotree_repos').toggleClass('open');
  });

  this.$view
    .find('.octotree_view_body')
    .on('click.jstree', '.jstree-open>a', function() {
      $.jstree.reference(this).close_node(this)
    })
    .on('click.jstree', '.jstree-closed>a', function() {
      $.jstree.reference(this).open_node(this)
    })
    .on('click', function(event) {
      var $target = $(event.target)

      // handle icon click, fix #122
      if ($target.is('i.jstree-icon')) $target = $target.parent()

      if (!$target.is('a.jstree-anchor')) return

      var href  = $target.attr('href')
        , $icon = $target.children().length
          ? $target.children(':first')
          : $target.siblings(':first') // handles child links in submodule

      // refocus after complete so that keyboard navigation works, fix #158
      $(document).one('pjax:success', function () {
        $.jstree.reference(this).get_container().focus()
      }.bind(this))

      if ($icon.hasClass('commit')) adapter.selectSubmodule(href)
      else if ($icon.hasClass('blob')) adapter.selectPath(href, store.get(STORE.TABSIZE))
    })
    .jstree({
      core    : { multiple: false, themes : { responsive : false } },
      plugins : ['wholerow']
    })
}

TreeView.prototype.showHeader = function(repo) {
  var adapter = this.adapter
  this.$view.find('.octotree_view_header')
    .html(
      '<div class="octotree_header_repo">' +
         '<a href="/' + repo.username + '">' + repo.username +'</a>'  +
         ' / ' +
         '<a data-pjax href="/' + repo.username + '/' + repo.reponame + '">' + repo.reponame +'</a>' +
       '</div>' +
       '<div class="octotree_header_branch">' +
         repo.branch +
       '</div>'
    )
    .on('click', 'a[data-pjax]', function(event) {
      event.preventDefault()
      adapter.selectPath($(this).attr('href') /* a.href always return absolute URL, don't want that */)
    })
}

TreeView.prototype.show = function(repo, treeData) {
  var self = this
    , treeContainer = self.$view.find('.octotree_view_body')
    , tree = treeContainer.jstree(true)
    , collapseTree = self.store.get(STORE.COLLAPSE)

  treeData = sort(treeData)
  if (collapseTree) treeData = collapse(treeData)
  tree.settings.core.data = treeData

  treeContainer.one('refresh.jstree', function() {
    self.syncSelection()
    $(self).trigger(EVENT.VIEW_READY)
  })

  tree.refresh(true)

  function sort(folder) {
    folder.sort(function(a, b) {
      if (a.type === b.type) return a.text === b.text ? 0 : a.text < b.text ? -1 : 1
      return a.type === 'blob' ? 1 : -1
    })
    folder.forEach(function(item) {
      if (item.type === 'tree') sort(item.children)
    })
    return folder
  }

  function collapse(folder) {
    return folder.map(function(item) {
      if (item.type === 'tree') {
        item.children = collapse(item.children)
        if (item.children.length === 1 && item.children[0].type === 'tree') {
          var onlyChild = item.children[0]
          onlyChild.text = item.text + '/' + onlyChild.text
          return onlyChild
        }
      }
      return item
    })
  }
}

TreeView.prototype.showRepos = function(repo, repos){
  var reposSorted = repos.sort(function(a, b){
    var aName = a.name.toLowerCase(),
        bName = b.name.toLowerCase();
    return aName === bName ? 0 : aName < bName ? -1 : 1;
  });

  var repoHtml = reposSorted.reduce(function(acc, r){
    if (r.name == repo.reponame){
      return acc;
    } else {
      return acc + '<li class="repoLink"><a href="' + r.html_url + '">' + r.name + '</a></li>';
    }
  }, "");

  this.$view.find('.octotree_repos')
    .html('<ul class="repoList">' + repoHtml + '</ul>');
}



TreeView.prototype.syncSelection = function() {
  var tree = this.$view.find('.octotree_view_body').jstree(true)
    , path = location.pathname

  if (!tree) return
  tree.deselect_all()

  // e.g. converts /buunguyen/octotree/type/branch/path to path
  var match = path.match(/(?:[^\/]+\/){4}(.*)/)
    , nodeId
  if (match) {
    nodeId = PREFIX + decodeURIComponent(match[1])
    tree.select_node(nodeId)
    tree.open_node(nodeId)
  }
}
